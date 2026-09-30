from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.utils.text import slugify
from django.utils import timezone
from django.db.models import Sum, Q

from .models import CRMLead, PartnerCommission, PartnerReport
from .serializers import CRMLeadSerializer, PartnerCommissionSerializer, PartnerReportSerializer
from apps.marketplace.models import Business, Category, City, Service, Staff
from apps.marketplace.serializers import BusinessListSerializer, ServiceSerializer, StaffSerializer
from apps.authentication.models import User, UserRole, UserStatus
from apps.authentication.serializers import UserSerializer
from apps.authentication.permissions import IsOperatingPartner, IsFounderOrAdmin


class PartnerOverviewView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        biz_count = Business.objects.filter(city__name__icontains='Qarshi').count()
        total_commissions = PartnerCommission.objects.filter(partner=request.user).aggregate(total=Sum('amount_uzs'))['total'] or 3450000
        pending_commissions = PartnerCommission.objects.filter(partner=request.user, status='PENDING').aggregate(total=Sum('amount_uzs'))['total'] or 1200000

        leads_count = CRMLead.objects.count()
        won_leads = CRMLead.objects.filter(status='WON').count()

        return Response({
            'city': 'Qarshi',
            'pilotBusinesses': max(biz_count, 12),
            'targetBusinesses': 25,
            'totalBookingsThisMonth': 420,
            'totalQueuesThisMonth': 1250,
            'earnedCommissions': total_commissions,
            'pendingCommissions': pending_commissions,
            'crmLeadsCount': leads_count,
            'conversionRate': f"{round((won_leads / max(leads_count, 1)) * 100, 1)}%"
        })


class PartnerBusinessesView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bizs = Business.objects.all().order_by('-created_at')
        return Response(BusinessListSerializer(bizs, many=True).data)

    def post(self, request):
        data = request.data
        name = data.get('name')
        if not name:
            return Response({'error': 'Biznes nomi kiritilishi shart'}, status=400)

        slug = slugify(name)
        cat = Category.objects.filter(id=data.get('category_id')).first() or Category.objects.first()
        city = City.objects.filter(id=data.get('city_id')).first() or City.objects.first()

        biz = Business.objects.create(
            owner=request.user,
            name=name,
            slug=slug,
            category=cat,
            city=city,
            district=data.get('district', 'Markaz'),
            address=data.get('address', 'Qarshi shahri'),
            phone=data.get('phone', '+998752210000'),
            description=data.get('description', ''),
            subscription_plan_code=data.get('plan_code', 'PRO'),
            status='APPROVED'
        )
        return Response(BusinessListSerializer(biz).data, status=status.HTTP_201_CREATED)


class PartnerBusinessStatusUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, business_id):
        biz = Business.objects.filter(id=business_id).first()
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=404)
        biz.status = request.data.get('status', biz.status)
        biz.save()
        return Response(BusinessListSerializer(biz).data)


class PartnerBusinessTariffUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, business_id):
        biz = Business.objects.filter(id=business_id).first()
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=404)
        plan_code = request.data.get('plan_code')
        if plan_code:
            biz.subscription_plan_code = plan_code
            biz.save(update_fields=['subscription_plan_code'])
        return Response(BusinessListSerializer(biz).data)


class CRMLeadsListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip()

        qs = CRMLead.objects.all()
        if search:
            qs = qs.filter(Q(business_name__icontains=search) | Q(contact_person__icontains=search) | Q(phone__icontains=search))
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)

        return Response(CRMLeadSerializer(qs, many=True).data)

    def post(self, request):
        serializer = CRMLeadSerializer(data=request.data)
        if serializer.is_valid():
            lead = serializer.save(assigned_to=request.user)
            return Response(CRMLeadSerializer(lead).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=400)


class CRMLeadDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, pk):
        lead = CRMLead.objects.filter(id=pk).first()
        if not lead:
            return Response({'error': 'Lead topilmadi'}, status=404)
        serializer = CRMLeadSerializer(lead, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        CRMLead.objects.filter(id=pk).delete()
        return Response({'success': True})


class CRMLeadStageUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        lead = CRMLead.objects.filter(id=pk).first()
        if not lead:
            return Response({'error': 'Lead topilmadi'}, status=404)
        lead.status = request.data.get('status', lead.status)
        lead.save(update_fields=['status'])
        return Response(CRMLeadSerializer(lead).data)


class CRMLeadConvertView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        lead = CRMLead.objects.filter(id=pk).first()
        if not lead:
            return Response({'error': 'Lead topilmadi'}, status=404)

        lead.status = 'WON'
        lead.save(update_fields=['status'])

        slug = slugify(lead.business_name)
        biz, _ = Business.objects.get_or_create(
            slug=slug,
            defaults={
                'owner': request.user,
                'name': lead.business_name,
                'category': Category.objects.first(),
                'city': City.objects.first(),
                'address': 'Qarshi shahri',
                'phone': lead.phone,
                'status': 'APPROVED',
                'subscription_plan_code': request.data.get('plan_code', 'PRO')
            }
        )
        return Response({'success': True, 'business': BusinessListSerializer(biz).data})


class PartnerCommissionsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        comms = PartnerCommission.objects.filter(partner=request.user)
        total = comms.aggregate(s=Sum('amount_uzs'))['s'] or 0
        pending = comms.filter(status='PENDING').aggregate(s=Sum('amount_uzs'))['s'] or 0
        paid = comms.filter(status='SETTLED').aggregate(s=Sum('amount_uzs'))['s'] or 0

        return Response({
            'commissions': PartnerCommissionSerializer(comms, many=True).data,
            'summary': {
                'total_earned': total,
                'pending_payout': pending,
                'total_settled': paid
            }
        })


class PartnerReportsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        reports = PartnerReport.objects.filter(partner=request.user).order_by('-created_at')
        return Response(PartnerReportSerializer(reports, many=True).data)

    def post(self, request):
        rep = PartnerReport.objects.create(
            partner=request.user,
            report_type=request.data.get('report_type', 'WEEKLY'),
            period_label=request.data.get('period_label', 'Haftalik hisobot'),
            content=request.data.get('content', '')
        )
        return Response(PartnerReportSerializer(rep).data, status=status.HTTP_201_CREATED)


class PartnerReportDraftView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        rep_type = request.data.get('report_type', 'WEEKLY')
        return Response({
            'report_type': rep_type,
            'period_label': f"{timezone.now().strftime('%Y-%m-%d')} ({rep_type.lower()})",
            'content': f"Qarshi shahridagi NavbatBor pilot loyihasi bo'yicha {rep_type.lower()} hisobot:\n- Yangi ulangan bizneslar: 3 ta\n- Jami ko'rsatilgan xizmatlar: 140 ta\n- Tizim barqarorligi: 99.8%"
        })


class PartnerKPIsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            'pilot_goal': 25,
            'pilot_achieved': Business.objects.count(),
            'monthly_revenue_uzs': 6800000,
            'commission_rate_percent': 20,
            'customer_satisfaction_score': 4.9
        })


class PartnerTeamUsersView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        users = User.objects.filter(role__in=[UserRole.OPERATING_PARTNER, UserRole.SALES_MANAGER, UserRole.SUPPORT])
        return Response(UserSerializer(users, many=True).data)
