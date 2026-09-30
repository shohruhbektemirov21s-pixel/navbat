from datetime import timedelta
from django.utils import timezone
from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.db.models import Q

from .models import QueueEntry, PendingQueueAction, QueueAuditLog, QueueStatus
from .serializers import QueueEntrySerializer, QueueAuditLogSerializer
from apps.marketplace.models import Business, Service, Staff
from apps.marketplace.serializers import BusinessListSerializer, ServiceSerializer
from apps.authentication.models import User, UserRole
from apps.authentication.permissions import IsFounderOrAdmin


class JoinQueueView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        biz_id = data.get('business_id')
        service_id = data.get('service_id')
        staff_id = data.get('staff_id')
        customer_name = data.get('customer_name')
        customer_phone = data.get('customer_phone', '')

        biz = Business.objects.filter(id=biz_id).first()
        if not biz:
            return Response({'error': 'Biznes topilmadi.'}, status=400)

        customer = request.user if request.user.is_authenticated else None
        if not customer_name:
            customer_name = customer.name if customer else 'Mehmon'
        if not customer_phone and customer:
            customer_phone = customer.phone or ''

        srv = Service.objects.filter(id=service_id).first() if service_id else biz.services.filter(is_active=True).first()
        stf = Staff.objects.filter(id=staff_id).first() if staff_id else biz.staff.filter(is_active=True).first()

        # Count waiting customers
        waiting_count = QueueEntry.objects.filter(business=biz, status=QueueStatus.WAITING).count()
        est_wait = (waiting_count + 1) * (srv.duration_minutes if srv else 15)

        entry = QueueEntry.objects.create(
            business=biz,
            service=srv,
            staff=stf,
            customer=customer,
            customer_name=customer_name,
            customer_phone=customer_phone,
            status=QueueStatus.WAITING,
            estimated_wait_minutes=est_wait
        )

        QueueAuditLog.objects.create(
            business=biz,
            action='JOIN_QUEUE',
            actor=customer,
            entry=entry,
            details=f"Navbat olindi: {entry.queue_number}"
        )

        return Response(QueueEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class MyActiveQueueView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        entry = QueueEntry.objects.filter(
            customer=request.user,
            status__in=[QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.SERVING]
        ).order_by('-created_at').first()

        return Response({
            'activeQueue': QueueEntrySerializer(entry).data if entry else None
        })


class BusinessQueueView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, business_id):
        entries = QueueEntry.objects.filter(
            business_id=business_id,
            created_at__date=timezone.now().date()
        ).order_by('created_at')
        return Response(QueueEntrySerializer(entries, many=True).data)


class CurrentQueueStateView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        biz_id = request.query_params.get('business_id')
        if not biz_id:
            return Response({'error': 'business_id required'}, status=400)

        current = QueueEntry.objects.filter(business_id=biz_id, status=QueueStatus.SERVING).first()
        if not current:
            current = QueueEntry.objects.filter(business_id=biz_id, status=QueueStatus.CALLED).first()

        next_cust = QueueEntry.objects.filter(business_id=biz_id, status=QueueStatus.WAITING).order_by('created_at').first()
        waiting_count = QueueEntry.objects.filter(business_id=biz_id, status=QueueStatus.WAITING).count()
        served_today = QueueEntry.objects.filter(
            business_id=biz_id,
            status=QueueStatus.COMPLETED,
            created_at__date=timezone.now().date()
        ).count()

        pending = PendingQueueAction.objects.filter(business_id=biz_id, status='PENDING').first()

        return Response({
            'currentCustomer': QueueEntrySerializer(current).data if current else None,
            'nextCustomer': QueueEntrySerializer(next_cust).data if next_cust else None,
            'waitingCount': waiting_count,
            'servedToday': served_today,
            'pendingAction': {'id': pending.id, 'status': pending.status} if pending else None
        })


class WaitingQueueListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        biz_id = request.query_params.get('business_id')
        waiting = QueueEntry.objects.filter(business_id=biz_id, status=QueueStatus.WAITING).order_by('created_at')
        return Response({
            'waitingCustomers': QueueEntrySerializer(waiting, many=True).data,
            'count': waiting.count()
        })


class OperatorCallNextView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz_id = request.data.get('business_id')
        biz = Business.objects.filter(id=biz_id).first()
        if not biz:
            return Response({'error': 'Biznes topilmadi.'}, status=404)

        # Mark current serving as completed
        prev = QueueEntry.objects.filter(business=biz, status__in=[QueueStatus.SERVING, QueueStatus.CALLED]).first()
        if prev:
            prev.status = QueueStatus.COMPLETED
            prev.served_at = timezone.now()
            prev.save(update_fields=['status', 'served_at'])

        # Get next waiting
        nxt = QueueEntry.objects.filter(business=biz, status=QueueStatus.WAITING).order_by('created_at').first()
        if not nxt:
            return Response({
                'success': False,
                'message': 'Kutayotgan mijozlar qolmadi.',
                'calledCustomer': None,
                'previousCustomer': QueueEntrySerializer(prev).data if prev else None
            })

        nxt.status = QueueStatus.CALLED
        nxt.called_at = timezone.now()
        nxt.save(update_fields=['status', 'called_at'])

        QueueAuditLog.objects.create(
            business=biz,
            action='CALL_NEXT',
            actor=request.user,
            entry=nxt,
            details=f"Chaqirildi: {nxt.queue_number}"
        )

        return Response({
            'success': True,
            'message': f"Mijoz {nxt.queue_number} chaqirildi!",
            'calledCustomer': QueueEntrySerializer(nxt).data,
            'previousCustomer': QueueEntrySerializer(prev).data if prev else None
        })


class OperatorAcceptView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        entry_id = request.data.get('entry_id')
        entry = QueueEntry.objects.filter(id=entry_id).first()
        if not entry:
            return Response({'error': 'Navbat topilmadi.'}, status=404)

        entry.status = QueueStatus.SERVING
        entry.save(update_fields=['status'])
        return Response({
            'success': True,
            'status': 'SERVING',
            'message': f"Mijoz {entry.queue_number} xizmatga qabul qilindi."
        })


class OperatorCancelView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        entry_id = request.data.get('entry_id')
        entry = QueueEntry.objects.filter(id=entry_id).first()
        if not entry:
            return Response({'error': 'Navbat topilmadi.'}, status=404)

        entry.status = QueueStatus.SKIPPED
        entry.save(update_fields=['status'])
        return Response({
            'success': True,
            'status': 'SKIPPED',
            'message': f"Mijoz {entry.queue_number} o‘tkazib yuborildi."
        })


class CompleteQueueServiceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz_id = request.data.get('business_id')
        entry_id = request.data.get('entry_id')

        entry = None
        if entry_id:
            entry = QueueEntry.objects.filter(id=entry_id).first()
        elif biz_id:
            entry = QueueEntry.objects.filter(business_id=biz_id, status=QueueStatus.SERVING).first()

        if entry:
            entry.status = QueueStatus.COMPLETED
            entry.served_at = timezone.now()
            entry.save(update_fields=['status', 'served_at'])

        return Response({
            'success': True,
            'message': 'Xizmat muvaffaqiyatli yakunlandi.',
            'completedCustomer': QueueEntrySerializer(entry).data if entry else None
        })


class NoShowQueueCustomerView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        entry_id = request.data.get('entry_id')
        entry = QueueEntry.objects.filter(id=entry_id).first()
        if entry:
            entry.status = QueueStatus.NO_SHOW
            entry.save(update_fields=['status'])
        return Response({'success': True, 'message': 'Mijoz kelmadi deb belgilandi.'})


class QueueAuditLogsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, business_id):
        logs = QueueAuditLog.objects.filter(business_id=business_id).order_by('-created_at')[:100]
        return Response(QueueAuditLogSerializer(logs, many=True).data)


class PublicQueueBoardView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        biz = Business.objects.filter(Q(slug=slug) | Q(id=slug)).first()
        if not biz:
            return Response({'error': 'Biznes topilmadi.'}, status=404)

        serving = QueueEntry.objects.filter(business=biz, status=QueueStatus.SERVING).first()
        called = QueueEntry.objects.filter(business=biz, status=QueueStatus.CALLED).order_by('-called_at')[:5]
        waiting = QueueEntry.objects.filter(business=biz, status=QueueStatus.WAITING).order_by('created_at')[:15]

        return Response({
            'business': {'id': biz.id, 'name': biz.name, 'slug': biz.slug, 'logo_url': biz.logo_url},
            'currentServing': QueueEntrySerializer(serving).data if serving else None,
            'calledList': QueueEntrySerializer(called, many=True).data,
            'waitingList': QueueEntrySerializer(waiting, many=True).data,
            'waitingCount': QueueEntry.objects.filter(business=biz, status=QueueStatus.WAITING).count(),
            'serverTime': timezone.now().isoformat()
        })


class ResolveQRCodeView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code = request.data.get('code', '').strip()
        # Parse QR code (e.g. "biz-xxx", "https://.../b/slug", or raw id)
        slug_or_id = code.split('/')[-1] if '/' in code else code
        biz = Business.objects.filter(Q(id=slug_or_id) | Q(slug=slug_or_id)).first()
        if biz:
            waiting_cnt = QueueEntry.objects.filter(business=biz, status=QueueStatus.WAITING).count()
            return Response({
                'type': 'business',
                'business': BusinessListSerializer(biz).data,
                'liveQueue': {
                    'activeCount': waiting_cnt,
                    'estimatedWaitMinutes': waiting_cnt * 15,
                    'avgDurationMinutes': 20
                },
                'services': ServiceSerializer(biz.services.filter(is_active=True), many=True).data
            })
        return Response({'type': 'unknown', 'message': 'QR kod aniqlanmadi'}, status=404)


class InstantQueueCheckInView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return JoinQueueView().post(request)


class AdminQueuesListView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        entries = QueueEntry.objects.all().order_by('-created_at')[:100]
        return Response(QueueEntrySerializer(entries, many=True).data)
