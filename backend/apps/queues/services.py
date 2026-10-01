"""Queue domain logic: atomic daily numbering, joining, operator transitions and pending 'call next'."""
import logging
import re
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.utils import local_today
from apps.marketplace.models import Business, BusinessStatus, Service, Staff

from .models import (
    ACTIVE_QUEUE_STATUSES, PendingActionStatus, PendingQueueAction, QueueAuditLog, QueueDailyCounter,
    QueueEntry, QueueStatus,
)

logger = logging.getLogger('apps.queues')

NUMBER_RE = re.compile(r'(\d+)$')
PENDING_TTL_SECONDS = 90
DEFAULT_SERVICE_MINUTES = 15
FINISHED_STATUSES = (QueueStatus.COMPLETED, QueueStatus.SKIPPED, QueueStatus.NO_SHOW)


class QueueError(ValidationError):
    """400 with an Uzbek `error` message."""

    def __init__(self, message):
        super().__init__({'error': message})


# ---------------------------------------------------------------------------
# Numbering
# ---------------------------------------------------------------------------
def _parse_number(queue_number):
    match = NUMBER_RE.search(queue_number or '')
    return int(match.group(1)) if match else 0


def _max_existing_number(business, day):
    numbers = QueueEntry.objects.filter(business=business, queue_date=day).values_list('queue_number', flat=True)
    return max((_parse_number(n) for n in numbers), default=0)


def format_queue_number(number):
    return f'A{number:03d}'


def allocate_queue_number(business, day=None):
    """Hand out the next ticket number for (business, day) using a row-locked counter.

    Numbers restart at A001 every local day. The counter row is locked with
    SELECT ... FOR UPDATE (PostgreSQL) and incremented with an atomic UPDATE, so
    concurrent joins never receive the same number; the UniqueConstraint on
    (business, queue_date, queue_number) is the final safety net.
    """
    day = day or local_today()
    with transaction.atomic():
        counter = QueueDailyCounter.objects.select_for_update().filter(business=business, date=day).first()
        if counter is None:
            try:
                with transaction.atomic():
                    counter = QueueDailyCounter.objects.create(
                        business=business, date=day, last_number=_max_existing_number(business, day)
                    )
            except IntegrityError:
                pass  # created concurrently; lock the winner's row below
            counter = QueueDailyCounter.objects.select_for_update().get(business=business, date=day)
        QueueDailyCounter.objects.filter(pk=counter.pk).update(last_number=F('last_number') + 1)
        counter.refresh_from_db(fields=['last_number'])
        return format_queue_number(counter.last_number)


def _resync_counter(business, day):
    QueueDailyCounter.objects.filter(business=business, date=day).update(last_number=_max_existing_number(business, day))


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------
def today_entries(business):
    return QueueEntry.objects.filter(business=business, queue_date=local_today())


def waiting_qs(business):
    return today_entries(business).filter(status=QueueStatus.WAITING).order_by('created_at')


def current_entry(business):
    qs = today_entries(business).select_related('service', 'staff', 'business')
    return (
        qs.filter(status=QueueStatus.SERVING).order_by('called_at', 'created_at').first()
        or qs.filter(status=QueueStatus.CALLED).order_by('called_at', 'created_at').first()
    )


def avg_service_minutes(service):
    return (service.duration_minutes if service and service.duration_minutes else DEFAULT_SERVICE_MINUTES)


def expire_stale_pending(business=None):
    qs = PendingQueueAction.objects.filter(status=PendingActionStatus.PENDING, expires_at__lte=timezone.now())
    if business is not None:
        qs = qs.filter(business=business)
    qs.update(status=PendingActionStatus.EXPIRED)


def active_pending(business):
    expire_stale_pending(business)
    return (
        PendingQueueAction.objects.select_related('called_entry', 'current_entry')
        .filter(business=business, status=PendingActionStatus.PENDING).order_by('-created_at').first()
    )


def log_queue(business, action, actor=None, entry=None, details=''):
    QueueAuditLog.objects.create(
        business=business, action=action, actor=actor if (actor and actor.is_authenticated) else None,
        entry=entry, details=details,
    )


# ---------------------------------------------------------------------------
# Customer side
# ---------------------------------------------------------------------------
def join_queue(*, business, customer=None, customer_name='', customer_phone='', service_id=None, staff_id=None,
               telegram_chat_id=''):
    if business.status != BusinessStatus.APPROVED:
        raise QueueError('Ushbu muassasa hozircha navbat qabul qilmaydi.')

    if service_id:
        service = Service.objects.filter(id=service_id, business=business, is_active=True).first()
        if not service:
            raise QueueError('Xizmat ushbu muassasaga tegishli emas yoki faol emas.')
    else:
        service = business.services.filter(is_active=True).order_by('price_uzs').first()

    if staff_id:
        staff = Staff.objects.filter(id=staff_id, business=business, is_active=True).first()
        if not staff:
            raise QueueError('Mutaxassis ushbu muassasaga tegishli emas.')
    else:
        staff = business.staff.filter(is_active=True).order_by('created_at').first()

    customer_name = (customer_name or '').strip()[:255] or (customer.name if customer else '')
    if not customer_name:
        raise QueueError('Ismingizni kiriting.')
    customer_phone = (customer_phone or '').strip()[:32] or ((customer.phone or '') if customer else '')

    if customer is not None:
        existing = today_entries(business).filter(customer=customer, status__in=ACTIVE_QUEUE_STATUSES).first()
        if existing:
            raise QueueError(f'Sizda bu muassasada faol navbat bor: #{existing.queue_number}.')

    chat_id = (telegram_chat_id or '').strip()[:64] or ((customer.telegram_chat_id or '') if customer else '')
    day = local_today()
    for attempt in range(3):
        try:
            with transaction.atomic():
                waiting_count = waiting_qs(business).count()
                entry = QueueEntry(
                    business=business, service=service, staff=staff, customer=customer,
                    customer_name=customer_name, customer_phone=customer_phone, telegram_chat_id=chat_id,
                    queue_date=day, status=QueueStatus.WAITING,
                    estimated_wait_minutes=(waiting_count + 1) * avg_service_minutes(service),
                )
                entry.queue_number = allocate_queue_number(business, day)
                entry.save()
                log_queue(business, 'JOIN_QUEUE', customer, entry, f'Navbat olindi: {entry.queue_number}')
                return entry
        except IntegrityError:
            logger.warning('queue_number_collision business=%s attempt=%s', business.id, attempt)
            _resync_counter(business, day)
    raise QueueError('Navbat raqamini ajratib bo‘lmadi, qayta urinib ko‘ring.')


def ahead_count(entry):
    if entry.status != QueueStatus.WAITING:
        return 0
    return QueueEntry.objects.filter(
        business_id=entry.business_id, queue_date=entry.queue_date, status=QueueStatus.WAITING,
        created_at__lt=entry.created_at,
    ).count()


# ---------------------------------------------------------------------------
# Operator side
# ---------------------------------------------------------------------------
def _lock_business(business):
    # Serialises operator actions per business (row lock on PostgreSQL, write lock on SQLite).
    return Business.objects.select_for_update().get(pk=business.pk)


def call_next(business, actor=None, *, source='WEB', pending_action=None):
    """Complete the current customer (if any) and call the next waiting one.

    Returns (called_entry | None, previous_entry | None).
    """
    now = timezone.now()
    with transaction.atomic():
        _lock_business(business)
        previous = current_entry(business)
        if previous:
            previous.status = QueueStatus.COMPLETED
            previous.served_at = now
            previous.save(update_fields=['status', 'served_at'])
            log_queue(business, 'COMPLETE', actor, previous, f'Yakunlandi: {previous.queue_number} ({source})')

        nxt = waiting_qs(business).select_related('service', 'staff', 'business').first()
        if nxt:
            nxt.status = QueueStatus.CALLED
            nxt.called_at = now
            nxt.save(update_fields=['status', 'called_at'])
            log_queue(business, 'CALL_NEXT', actor, nxt, f'Chaqirildi: {nxt.queue_number} ({source})')

        pending_qs = PendingQueueAction.objects.filter(business=business, status=PendingActionStatus.PENDING)
        if pending_action is not None:
            PendingQueueAction.objects.filter(pk=pending_action.pk).update(
                status=PendingActionStatus.CONFIRMED, confirmed_at=now,
                called_entry=nxt or pending_action.called_entry,
            )
            pending_qs = pending_qs.exclude(pk=pending_action.pk)
        pending_qs.update(status=PendingActionStatus.CANCELLED)

    if nxt:
        transaction.on_commit(lambda: notify_called(nxt))
    return nxt, previous


def request_next(business, actor):
    """Create a PENDING 'call next' action (confirmed via web button or Telegram inline button)."""
    from apps.notifications.services import business_chat_id, esc, inline_keyboard, send_telegram_message

    nxt = waiting_qs(business).first()
    if not nxt:
        raise QueueError('Navbatda kutayotgan mijoz mavjud emas.')
    current = current_entry(business)
    chat_id = business_chat_id(business) or ((actor.telegram_chat_id or '') if actor else '')
    with transaction.atomic():
        PendingQueueAction.objects.filter(business=business, status=PendingActionStatus.PENDING).update(
            status=PendingActionStatus.CANCELLED
        )
        action = PendingQueueAction.objects.create(
            business=business, operator=actor, called_entry=nxt, current_entry=current,
            status=PendingActionStatus.PENDING, source='WEB', telegram_chat_id=chat_id,
            expires_at=timezone.now() + timedelta(seconds=PENDING_TTL_SECONDS),
        )
    telegram_sent = False
    if chat_id:
        current_label = f'{esc(current.queue_number)} — {esc(current.customer_name)}' if current else 'Mavjud emas'
        text = (
            '🔔 <b>NAVBATBOR</b>\n\nKeyingi mijozni chaqirishni tasdiqlaysizmi?\n\n'
            f'<b>Hozirgi mijoz:</b>\n{current_label}\n\n'
            f'<b>Keyingi mijoz:</b>\n{esc(nxt.queue_number)} — {esc(nxt.customer_name)}'
        )
        telegram_sent = send_telegram_message(chat_id, text, inline_keyboard(
            [{'text': '✅ KEYINGI MIJOZNI CHAQIRISH', 'callback_data': f'confirm_next_{action.id}'}],
            [{'text': '❌ BEKOR QILISH', 'callback_data': f'cancel_next_{action.id}'}],
        ))
    return action, telegram_sent


def confirm_pending(action, actor=None, *, source='WEB'):
    if action.status != PendingActionStatus.PENDING:
        raise QueueError('Bu amal allaqachon yakunlangan yoki bekor qilingan.')
    if action.is_expired:
        PendingQueueAction.objects.filter(pk=action.pk).update(status=PendingActionStatus.EXPIRED)
        raise QueueError('Tasdiqlash muddati tugagan. Qaytadan urinib ko‘ring.')
    return call_next(action.business, actor, source=source, pending_action=action)


def cancel_pending(action, actor=None):
    if action.status == PendingActionStatus.PENDING:
        PendingQueueAction.objects.filter(pk=action.pk).update(status=PendingActionStatus.CANCELLED)
        log_queue(action.business, 'PENDING_CANCELLED', actor, action.called_entry, 'Keyingi mijozni chaqirish bekor qilindi')
        action.status = PendingActionStatus.CANCELLED


ACTION_TRANSITIONS = {
    'CALL': QueueStatus.CALLED,
    'SERVE': QueueStatus.SERVING,
    'COMPLETE': QueueStatus.COMPLETED,
    'SKIP': QueueStatus.SKIPPED,
    'NO_SHOW': QueueStatus.NO_SHOW,
}


def apply_action(entry, action, actor=None):
    """Operator transition on a single entry. `action` is one of ACTION_TRANSITIONS."""
    action = (action or '').upper()
    if action not in ACTION_TRANSITIONS:
        raise QueueError('Noto‘g‘ri amal. Ruxsat etilgan: CALL, SERVE, COMPLETE, SKIP, NO_SHOW.')
    if entry.status in FINISHED_STATUSES:
        raise QueueError(f'#{entry.queue_number} navbati allaqachon yakunlangan.')
    if action == 'COMPLETE' and entry.status == QueueStatus.WAITING:
        raise QueueError('Kutayotgan mijozni avval chaqiring yoki qabul qiling.')

    new_status = ACTION_TRANSITIONS[action]
    now = timezone.now()
    entry.status = new_status
    fields = ['status']
    if new_status == QueueStatus.CALLED:
        entry.called_at = now
        fields.append('called_at')
    elif new_status == QueueStatus.SERVING and not entry.called_at:
        entry.called_at = now
        fields.append('called_at')
    elif new_status == QueueStatus.COMPLETED:
        entry.served_at = now
        fields.append('served_at')
    entry.save(update_fields=fields)
    log_queue(entry.business, action, actor, entry, f'{entry.queue_number}: {new_status}')
    if new_status == QueueStatus.CALLED:
        transaction.on_commit(lambda: notify_called(entry))
    return entry


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
def entry_chat_id(entry):
    if entry.telegram_chat_id:
        return entry.telegram_chat_id
    if entry.customer_id and entry.customer and entry.customer.telegram_notifications_enabled:
        return entry.customer.telegram_chat_id or ''
    return ''


def notify_called(entry):
    from apps.notifications.services import esc, notify_user, send_telegram_message

    chat_id = entry_chat_id(entry)
    if chat_id:
        send_telegram_message(chat_id, (
            '📢 <b>Navbatingiz keldi!</b>\n━━━━━━━━━━━━━━━━\n'
            f'🏢 Muassasa: <b>{esc(entry.business.name)}</b>\n'
            f'🎫 Navbat raqami: <b>#{esc(entry.queue_number)}</b>\n'
            'Iltimos, qabulga kiring.'
        ))
    if entry.customer_id:
        notify_user(entry.customer, f'Navbatingiz keldi: #{entry.queue_number}',
                    f'{entry.business.name}: iltimos, qabulga kiring.', 'QUEUE_CALLED')
