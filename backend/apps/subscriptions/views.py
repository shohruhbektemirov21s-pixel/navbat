from urllib.parse import quote

from django.conf import settings
from rest_framework import permissions, status, views
from rest_framework.response import Response

from apps.authentication.permissions import IsFounderOrAdmin
from apps.core.models import log_audit
from apps.core.utils import client_ip, parse_int
from apps.marketplace.models import Business
from apps.marketplace.services import get_user_business

from . import services as billing
from .models import AdPromotion, SubscriptionPlan, SubscriptionTransaction, TransactionStatus
from .serializers import AdPromotionSerializer, SubscriptionPlanSerializer, SubscriptionTransactionSerializer


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def payment_contact_url(message):
    return f'{settings.TELEGRAM_PAYMENT_CONTACT_URL}?text={quote(message)}'


class PlansListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(SubscriptionPlanSerializer(SubscriptionPlan.objects.order_by('price_uzs'), many=True).data)


class BusinessSubscriptionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        biz = get_user_business(request.user)
        plans = SubscriptionPlan.objects.order_by('price_uzs')
        plan = plans.filter(code=biz.subscription_plan_code).first()
        plan_data = SubscriptionPlanSerializer(plan).data if plan else None
        days = billing.days_left(biz)
        sub_status = billing.subscription_status(biz)
        txs = SubscriptionTransaction.objects.filter(business=biz).select_related('business__owner')[:20]
        return Response({
            'business': {
                'id': biz.id, 'name': biz.name, 'subscription_plan_code': biz.subscription_plan_code,
                'subscription_expires_at': biz.subscription_expires_at.isoformat() if biz.subscription_expires_at else None,
                'subscription_status': sub_status, 'is_trial': biz.is_trial, 'trial_used': biz.trial_used,
                'trial_started_at': biz.trial_started_at.isoformat() if biz.trial_started_at else None,
                'telegram_chat_id': biz.telegram_chat_id, 'days_left': days,
            },
            'daysLeft': days,
            'isTrial': sub_status == 'TRIAL',
            'isExpired': sub_status == 'EXPIRED',
            'plan': plan_data,
            'allPlans': SubscriptionPlanSerializer(plans, many=True).data,
            'transactions': SubscriptionTransactionSerializer(txs, many=True).data,
            # Legacy keys
            'currentPlan': plan_data,
            'planCode': biz.subscription_plan_code,
            'expiresAt': biz.subscription_expires_at.isoformat() if biz.subscription_expires_at else None,
        })


class ActivateBusinessTrialView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = get_user_business(request.user, owner_only=True)
        billing.activate_trial(biz)
        log_audit(request.user, 'TRIAL_ACTIVATED', 'BUSINESS', biz.id, '14 kunlik bepul sinov', client_ip(request))
        return Response({'success': True, 'expires_at': biz.subscription_expires_at.isoformat(), 'days_left': billing.TRIAL_DAYS,
                         'message': '14 kunlik bepul PRO sinov muddati faollashtirildi!'})


def _payment_response(tx, plan_data, message_text):
    return {
        'success': True,
        'transactionId': tx.id,
        'transaction': SubscriptionTransactionSerializer(tx).data,
        'message': message_text,
        'telegramUrl': payment_contact_url(message_text),
        'plan': plan_data,
        'status': tx.status,
    }


class RequestTelegramPaymentView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = get_user_business(request.user, owner_only=True)
        tx, plan = billing.request_subscription_payment(biz, request.user, request.data.get('plan_code') or 'PRO', 1)
        log_audit(request.user, 'TELEGRAM_PAYMENT_REQUESTED', 'BUSINESS', biz.id, f'Tarif: {plan.code}', client_ip(request))
        text = (f"Salom! NavbatBor tarifini sotib olmoqchiman.\nBiznes: {biz.name}\nTarif: {plan.name}\n"
                f"Narx: {plan.price_uzs:,} so‘m".replace(',', ' '))
        return Response(_payment_response(tx, SubscriptionPlanSerializer(plan).data, text))


class RenewBusinessSubscriptionView(views.APIView):
    """Creates a PENDING payment request; the plan is extended only after admin confirmation."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = get_user_business(request.user, owner_only=True)
        months = parse_int(request.data.get('months'), default=1, min_value=1, max_value=12, field='months')
        tx, plan = billing.request_subscription_payment(
            biz, request.user, request.data.get('plan_code') or biz.subscription_plan_code or 'PRO', months,
            request.data.get('payment_method') or 'TELEGRAM',
        )
        log_audit(request.user, 'SUBSCRIPTION_RENEW_REQUESTED', 'BUSINESS', biz.id, f'{plan.code} x {months} oy',
                  client_ip(request))
        text = (f"Salom! NavbatBor tarifini uzaytirmoqchiman.\nBiznes: {biz.name}\nTarif: {plan.name}\n"
                f"Muddat: {months} oy\nNarx: {tx.amount_uzs:,} so‘m".replace(',', ' '))
        payload = _payment_response(tx, SubscriptionPlanSerializer(plan).data, text)
        payload['message'] = 'To‘lov so‘rovi yaratildi. Administrator to‘lovni tasdiqlagach tarif uzaytiriladi.'
        return Response(payload, status=status.HTTP_201_CREATED)


class BusinessPromoteView(views.APIView):
    """Creates a PENDING promotion payment; sponsorship starts only after admin confirmation."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = get_user_business(request.user, owner_only=True)
        duration = parse_int(request.data.get('duration_days'), default=30, min_value=1, max_value=90, field='duration_days')
        tx = billing.request_promotion_payment(biz, request.user, duration, request.data.get('payment_method') or 'TELEGRAM')
        log_audit(request.user, 'PROMOTION_REQUESTED', 'BUSINESS', biz.id, f'TOP reklama: {duration} kun', client_ip(request))
        text = (f"Salom! NavbatBor TOP reklamasini sotib olmoqchiman.\nBiznes: {biz.name}\nMuddat: {duration} kun\n"
                f"Narx: {tx.amount_uzs:,} so‘m".replace(',', ' '))
        payload = _payment_response(tx, None, text)
        payload['message'] = 'Reklama uchun to‘lov so‘rovi yaratildi. To‘lov tasdiqlangach reklama faollashadi.'
        payload['promo'] = {'transaction_id': tx.id, 'duration_days': duration, 'amount_uzs': tx.amount_uzs, 'status': tx.status}
        return Response(payload, status=status.HTTP_201_CREATED)


class BusinessAdAnalyticsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.bookings.models import Booking

        biz = get_user_business(request.user)
        promo = AdPromotion.objects.filter(business=biz, status='ACTIVE').order_by('-start_date').first()
        impressions = promo.impressions if promo else 0
        clicks = promo.clicks if promo else 0
        ctr = f'{(clicks / impressions * 100):.1f}%' if impressions else '0.0%'
        return Response({
            'is_sponsored': biz.is_sponsored,
            'active_promo': AdPromotionSerializer(promo).data if promo else None,
            'pending_requests': SubscriptionTransaction.objects.filter(
                business=biz, kind='PROMOTION', status=TransactionStatus.PENDING).count(),
            'impressions': impressions,
            'clicks': clicks,
            'bookings_count': Booking.objects.filter(business=biz).count(),
            'bookings_from_ads': 0,
            'ctr': ctr,
            'ctr_percent': ctr,
        })


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
class AdminSubscriptionsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        bizs = Business.objects.select_related('owner').order_by('-created_at')
        subscriptions = []
        for b in bizs:
            subscriptions.append({
                'id': b.id, 'business_id': b.id, 'name': b.name, 'business_name': b.name, 'phone': b.phone,
                'plan_code': b.subscription_plan_code, 'subscription_plan_code': b.subscription_plan_code,
                'expires_at': b.subscription_expires_at.isoformat() if b.subscription_expires_at else None,
                'subscription_expires_at': b.subscription_expires_at.isoformat() if b.subscription_expires_at else None,
                'subscription_status': billing.subscription_status(b), 'days_left': billing.days_left(b),
                'is_trial': b.is_trial, 'trial_used': b.trial_used,
                'owner_name': b.owner.name, 'owner_email': b.owner.email, 'owner_phone': b.owner.phone,
                'created_at': b.created_at.isoformat(),
            })
        txs = SubscriptionTransaction.objects.select_related('business__owner')
        return Response({
            'subscriptions': subscriptions,
            'pendingTransactions': SubscriptionTransactionSerializer(txs.filter(status=TransactionStatus.PENDING), many=True).data,
            'transactions': SubscriptionTransactionSerializer(txs[:50], many=True).data,
        })


class AdminConfirmPaymentView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, pk):
        tx = billing.confirm_transaction(pk, request.user)
        log_audit(request.user, 'SUBSCRIPTION_PAYMENT_CONFIRMED', 'TRANSACTION', tx.id,
                  f'{tx.business.name}: {tx.kind} {tx.plan_code} {tx.amount_uzs} so‘m', client_ip(request),
                  target_name=tx.business.name, new_value=tx.plan_code)
        biz = tx.business
        return Response({'success': True, 'message': 'To‘lov tasdiqlandi',
                         'newExpiry': biz.subscription_expires_at.isoformat() if biz.subscription_expires_at else None,
                         'plan_code': biz.subscription_plan_code})


class AdminCancelPaymentView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, pk):
        tx = billing.cancel_transaction(pk)
        log_audit(request.user, 'SUBSCRIPTION_PAYMENT_CANCELLED', 'TRANSACTION', tx.id, 'Administrator tomonidan bekor qilindi',
                  client_ip(request))
        return Response({'success': True, 'message': 'To‘lov bekor qilindi'})


class AdminExtendSubscriptionView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, business_id):
        biz = Business.objects.filter(id=business_id).first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        months = parse_int(request.data.get('months'), default=1, min_value=1, max_value=24, field='months')
        billing.extend_subscription(biz, months, request.data.get('plan_code'))
        log_audit(request.user, 'ADMIN_SUBSCRIPTION_EXTENDED', 'BUSINESS', biz.id, f'{biz.subscription_plan_code} +{months} oy',
                  client_ip(request), target_name=biz.name)
        return Response({'success': True, 'message': f'Obuna {months} oyga uzaytirildi',
                         'expires_at': biz.subscription_expires_at.isoformat()})


class AdminPromotionsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        promos = AdPromotion.objects.select_related('business').order_by('-created_at')
        return Response(AdPromotionSerializer(promos, many=True).data)
