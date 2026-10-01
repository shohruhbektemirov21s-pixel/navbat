"""Subscription & promotion billing rules.

Businesses can only *request* paid features: every request creates a PENDING
SubscriptionTransaction. Plans / sponsorship are activated exclusively in
`confirm_transaction()`, which is reachable only by admins.
"""
import logging
import math
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.authentication.models import UserRole, UserStatus
from apps.core.utils import local_today

from .models import AdPromotion, SubscriptionPlan, SubscriptionTransaction, TransactionKind, TransactionStatus

logger = logging.getLogger('apps.subscriptions')

DAYS_PER_MONTH = 30
TRIAL_DAYS = 14
EXPIRING_SOON_DAYS = 3
PROMOTION_PRICE_PER_DAY = 7000
PROMOTION_PRICE_30_DAYS = 190000


def days_left(business):
    if not business.subscription_expires_at:
        return None
    seconds = (business.subscription_expires_at - timezone.now()).total_seconds()
    return math.ceil(seconds / 86400) if seconds > 0 else 0


def subscription_status(business):
    if not business.subscription_expires_at:
        return 'ACTIVE'
    if business.subscription_expires_at <= timezone.now():
        return 'EXPIRED'
    if business.is_trial:
        return 'TRIAL'
    if (days_left(business) or 0) <= EXPIRING_SOON_DAYS:
        return 'EXPIRING_SOON'
    return 'ACTIVE'


def get_plan(plan_code):
    plan = SubscriptionPlan.objects.filter(code=str(plan_code or '').upper()).first()
    if not plan:
        raise ValidationError({'error': 'Tarif rejasi topilmadi.'})
    return plan


def promotion_price(duration_days):
    return PROMOTION_PRICE_30_DAYS if duration_days == 30 else duration_days * PROMOTION_PRICE_PER_DAY


def request_subscription_payment(business, user, plan_code, months=1, payment_method='TELEGRAM'):
    plan = get_plan(plan_code)
    if plan.price_uzs <= 0:
        raise ValidationError({'error': 'Bepul tarif uchun to‘lov talab qilinmaydi.'})
    return SubscriptionTransaction.objects.create(
        business=business, kind=TransactionKind.SUBSCRIPTION, plan_code=plan.code,
        amount_uzs=plan.price_uzs * months, months=months, duration_days=months * DAYS_PER_MONTH,
        payment_method=str(payment_method or 'TELEGRAM')[:32], status=TransactionStatus.PENDING, requested_by=user,
    ), plan


def request_promotion_payment(business, user, duration_days, payment_method='TELEGRAM'):
    return SubscriptionTransaction.objects.create(
        business=business, kind=TransactionKind.PROMOTION, plan_code='TOP_FEATURED',
        amount_uzs=promotion_price(duration_days), months=0, duration_days=duration_days,
        payment_method=str(payment_method or 'TELEGRAM')[:32], status=TransactionStatus.PENDING, requested_by=user,
    )


def _extend(business, days, plan_code=None):
    now = timezone.now()
    base = business.subscription_expires_at if (business.subscription_expires_at and business.subscription_expires_at > now) else now
    business.subscription_expires_at = base + timedelta(days=days)
    if plan_code:
        business.subscription_plan_code = plan_code
    business.is_trial = False
    business.save(update_fields=['subscription_expires_at', 'subscription_plan_code', 'is_trial'])


def activate_trial(business):
    if business.trial_used:
        raise ValidationError({'error': 'Ushbu muassasa 14 kunlik bepul sinovdan allaqachon foydalangan.'})
    now = timezone.now()
    business.subscription_plan_code = 'PRO'
    business.subscription_expires_at = now + timedelta(days=TRIAL_DAYS)
    business.is_trial = True
    business.trial_used = True
    business.trial_started_at = now
    business.save(update_fields=['subscription_plan_code', 'subscription_expires_at', 'is_trial', 'trial_used', 'trial_started_at'])
    return business


def extend_subscription(business, months, plan_code=None):
    """Admin-granted extension (no payment); recorded as a confirmed zero-amount transaction."""
    plan_code = get_plan(plan_code).code if plan_code else business.subscription_plan_code
    with transaction.atomic():
        _extend(business, months * DAYS_PER_MONTH, plan_code)
        SubscriptionTransaction.objects.create(
            business=business, kind=TransactionKind.SUBSCRIPTION, plan_code=plan_code, amount_uzs=0, months=months,
            duration_days=months * DAYS_PER_MONTH, payment_method='ADMIN_GRANTED', status=TransactionStatus.CONFIRMED,
            confirmed_at=timezone.now(),
        )
    return business


def record_partner_commission(tx):
    """30% of a confirmed payment goes to the business's operating partner."""
    from apps.authentication.models import User
    from apps.partners.models import PARTNER_COMMISSION_RATE, PartnerCommission

    if tx.amount_uzs <= 0:
        return None
    business = tx.business
    partner = business.partner
    if partner is None or partner.role != UserRole.OPERATING_PARTNER:
        partner = User.objects.filter(role=UserRole.OPERATING_PARTNER, status=UserStatus.ACTIVE).order_by('created_at').first()
    if partner is None:
        return None
    share = int(round(tx.amount_uzs * PARTNER_COMMISSION_RATE))
    return PartnerCommission.objects.create(
        partner=partner, business=business, transaction=tx, plan_code=tx.plan_code,
        total_amount_uzs=tx.amount_uzs, partner_rate=PARTNER_COMMISSION_RATE, amount_uzs=share,
        navbatbor_share_uzs=tx.amount_uzs - share, period_month=local_today().strftime('%Y-%m'),
        status='PENDING', payout_notes='',
    )


def confirm_transaction(tx_id, admin):
    """Admin confirms a PENDING payment and only then grants the paid feature."""
    from apps.notifications.services import business_chat_id, esc, notify_user, send_telegram_message

    with transaction.atomic():
        tx = SubscriptionTransaction.objects.select_for_update().select_related('business__owner').filter(id=tx_id).first()
        if not tx:
            raise ValidationError({'error': 'Tranzaksiya topilmadi.'})
        if tx.status != TransactionStatus.PENDING:
            raise ValidationError({'error': 'Faqat kutilayotgan (PENDING) to‘lovni tasdiqlash mumkin.'})
        business = tx.business
        if tx.kind == TransactionKind.PROMOTION:
            now = timezone.now()
            business.is_sponsored = True
            business.save(update_fields=['is_sponsored'])
            AdPromotion.objects.create(
                business=business, transaction=tx, title=f'{business.name} — TOP reklama',
                status='ACTIVE', is_active=True, start_date=now, end_date=now + timedelta(days=tx.duration_days),
                total_amount=tx.amount_uzs, payment_method=tx.payment_method,
            )
            summary = f'TOP reklama {tx.duration_days} kunga faollashtirildi'
        else:
            _extend(business, tx.duration_days or tx.months * DAYS_PER_MONTH, tx.plan_code)
            summary = f'{tx.plan_code} tarifi {tx.duration_days} kunga uzaytirildi'
        tx.status = TransactionStatus.CONFIRMED
        tx.confirmed_by = admin
        tx.confirmed_at = timezone.now()
        tx.save(update_fields=['status', 'confirmed_by', 'confirmed_at'])
        record_partner_commission(tx)

    notify_user(business.owner, 'To‘lovingiz tasdiqlandi', f'{business.name}: {summary}.', 'PAYMENT_CONFIRMED')
    chat_id = business_chat_id(business)
    if chat_id:
        send_telegram_message(chat_id, (
            '🎉 <b>To‘lovingiz tasdiqlandi!</b>\n━━━━━━━━━━━━━━━━\n'
            f'🏢 Muassasa: <b>{esc(business.name)}</b>\n✅ {esc(summary)}'
        ))
    return tx


def cancel_transaction(tx_id):
    with transaction.atomic():
        tx = SubscriptionTransaction.objects.select_for_update().filter(id=tx_id).first()
        if not tx:
            raise ValidationError({'error': 'Tranzaksiya topilmadi.'})
        if tx.status != TransactionStatus.PENDING:
            raise ValidationError({'error': 'Faqat kutilayotgan (PENDING) to‘lovni bekor qilish mumkin.'})
        tx.status = TransactionStatus.CANCELLED
        tx.save(update_fields=['status'])
    return tx
