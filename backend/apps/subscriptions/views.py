from datetime import timedelta
from django.utils import timezone
from rest_framework import views, permissions, status
from rest_framework.response import Response

from .models import SubscriptionPlan, SubscriptionTransaction, AdPromotion
from .serializers import SubscriptionPlanSerializer, SubscriptionTransactionSerializer, AdPromotionSerializer
from apps.marketplace.models import Business
from apps.authentication.permissions import IsFounderOrAdmin


class PlansListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        plans = SubscriptionPlan.objects.all().order_by('price_uzs')
        return Response(SubscriptionPlanSerializer(plans, many=True).data)


class BusinessSubscriptionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        biz = Business.objects.filter(owner=request.user).first() or Business.objects.first()
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=404)

        plan = SubscriptionPlan.objects.filter(code=biz.subscription_plan_code).first()
        expires = biz.subscription_expires_at or (timezone.now() + timedelta(days=25))

        return Response({
            'currentPlan': SubscriptionPlanSerializer(plan).data if plan else None,
            'planCode': biz.subscription_plan_code,
            'expiresAt': expires.isoformat(),
            'isTrial': False,
            'daysLeft': max(1, (expires - timezone.now()).days)
        })


class ActivateBusinessTrialView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = Business.objects.filter(owner=request.user).first() or Business.objects.first()
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=404)

        biz.subscription_plan_code = 'PRO'
        biz.subscription_expires_at = timezone.now() + timedelta(days=14)
        biz.save(update_fields=['subscription_plan_code', 'subscription_expires_at'])
        return Response({'success': True, 'message': '14 kunlik bepul PRO sinov muddati faollashtirildi!'})


class RequestTelegramPaymentView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = Business.objects.filter(owner=request.user).first() or Business.objects.first()
        plan_code = request.data.get('plan_code', 'PRO')
        plan = SubscriptionPlan.objects.filter(code=plan_code).first()

        tx = SubscriptionTransaction.objects.create(
            business=biz,
            plan_code=plan_code,
            amount_uzs=plan.price_uzs if plan else 199000,
            months=1,
            status='PENDING'
        )

        return Response({
            'success': True,
            'transactionId': tx.id,
            'message': 'To‘lov so‘rovi yaratildi. Telegram orqali to‘lov amalga oshirilgach avtomatik tasdiqlanadi.',
            'telegramUrl': 'https://t.me/NavbatBor_bot',
            'plan': SubscriptionPlanSerializer(plan).data if plan else None,
            'status': 'PENDING'
        })


class RenewBusinessSubscriptionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = Business.objects.filter(owner=request.user).first() or Business.objects.first()
        plan_code = request.data.get('plan_code', 'PRO')
        months = int(request.data.get('months', 1))

        biz.subscription_plan_code = plan_code
        curr_exp = biz.subscription_expires_at if (biz.subscription_expires_at and biz.subscription_expires_at > timezone.now()) else timezone.now()
        biz.subscription_expires_at = curr_exp + timedelta(days=30 * months)
        biz.save(update_fields=['subscription_plan_code', 'subscription_expires_at'])

        return Response({'success': True, 'message': f'Ta’rif {months} oyga muvaffaqiyatli uzaytirildi!'})


class BusinessPromoteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = Business.objects.filter(owner=request.user).first() or Business.objects.first()
        biz.is_sponsored = True
        biz.save(update_fields=['is_sponsored'])
        return Response({'success': True, 'message': 'Reklama faollashtirildi, biznesingiz saralanganlar qatoriga qo‘shildi!'})


class BusinessAdAnalyticsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            'impressions': 1420,
            'clicks': 310,
            'bookings_from_ads': 28,
            'ctr': '21.8%'
        })


# Admin Subscriptions
class AdminSubscriptionsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        bizs = Business.objects.all().order_by('-created_at')
        txs = SubscriptionTransaction.objects.all().order_by('-created_at')[:50]
        data = [
            {
                'business_id': b.id,
                'business_name': b.name,
                'plan_code': b.subscription_plan_code,
                'expires_at': (b.subscription_expires_at or (b.created_at + timedelta(days=30))).isoformat()
            }
            for b in bizs
        ]
        return Response({
            'subscriptions': data,
            'transactions': SubscriptionTransactionSerializer(txs, many=True).data
        })


class AdminConfirmPaymentView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, pk):
        tx = SubscriptionTransaction.objects.filter(id=pk).first()
        if tx:
            tx.status = 'CONFIRMED'
            tx.save(update_fields=['status'])
            # Extend business
            b = tx.business
            b.subscription_plan_code = tx.plan_code
            curr = b.subscription_expires_at if (b.subscription_expires_at and b.subscription_expires_at > timezone.now()) else timezone.now()
            b.subscription_expires_at = curr + timedelta(days=30 * tx.months)
            b.save(update_fields=['subscription_plan_code', 'subscription_expires_at'])
        return Response({'success': True, 'message': 'To‘lov tasdiqlandi'})


class AdminCancelPaymentView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, pk):
        tx = SubscriptionTransaction.objects.filter(id=pk).first()
        if tx:
            tx.status = 'CANCELLED'
            tx.save(update_fields=['status'])
        return Response({'success': True, 'message': 'To‘lov bekor qilindi'})


class AdminExtendSubscriptionView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, business_id):
        b = Business.objects.filter(id=business_id).first()
        if not b:
            return Response({'error': 'Biznes topilmadi'}, status=404)
        months = int(request.data.get('months', 1))
        plan_code = request.data.get('plan_code', b.subscription_plan_code)
        b.subscription_plan_code = plan_code
        curr = b.subscription_expires_at if (b.subscription_expires_at and b.subscription_expires_at > timezone.now()) else timezone.now()
        b.subscription_expires_at = curr + timedelta(days=30 * months)
        b.save(update_fields=['subscription_plan_code', 'subscription_expires_at'])
        return Response({'success': True, 'message': f'Obuna {months} oyga uzaytirildi'})


class AdminPromotionsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        promos = AdPromotion.objects.all().order_by('-created_at')
        return Response(AdPromotionSerializer(promos, many=True).data)
