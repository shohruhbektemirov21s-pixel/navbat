"""Booking availability & creation rules (all times are local Asia/Tashkent wall-clock 'HH:MM')."""
from datetime import datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.utils import hhmm_to_minutes, js_weekday, local_now, minutes_to_hhmm
from apps.marketplace.models import Business, BusinessHours, BusinessStatus, Staff

from .models import ACTIVE_BOOKING_STATUSES, BlockedTime, Booking, BookingStatus

DEFAULT_OPEN, DEFAULT_CLOSE = '09:00', '18:00'
SLOT_STEP_MAX = 30
TODAY_MIN_NOTICE_MINUTES = 15
MAX_DAYS_AHEAD = 90


class BookingError(ValidationError):
    def __init__(self, message):
        super().__init__({'error': message})


def day_schedule(business, day):
    """Return (open_min, close_min, [(break_start, break_end)]) or None when closed that day."""
    hours = BusinessHours.objects.filter(business=business, day_of_week=js_weekday(day)).first()
    if hours and hours.is_closed:
        return None
    open_m = hhmm_to_minutes(hours.open_time if hours else DEFAULT_OPEN)
    close_m = hhmm_to_minutes(hours.close_time if hours else DEFAULT_CLOSE)
    if open_m is None or close_m is None or open_m >= close_m:
        return None
    breaks = []
    if hours:
        b_s, b_e = hhmm_to_minutes(hours.break_start), hhmm_to_minutes(hours.break_end)
        if b_s is not None and b_e is not None and b_s < b_e:
            breaks.append((b_s, b_e))
    return open_m, close_m, breaks


def _blocked_ranges(business, day, staff):
    tz = timezone.get_current_timezone()
    day_start = timezone.make_aware(datetime.combine(day, time.min), tz)
    day_end = day_start + timedelta(days=1)
    qs = BlockedTime.objects.filter(business=business, start_datetime__lt=day_end, end_datetime__gt=day_start)
    if staff is not None:
        from django.db.models import Q
        qs = qs.filter(Q(staff__isnull=True) | Q(staff=staff))
    else:
        qs = qs.filter(staff__isnull=True)
    ranges = []
    for block in qs:
        start = max(timezone.localtime(block.start_datetime, tz), day_start)
        end = min(timezone.localtime(block.end_datetime, tz), day_end)
        start_m = int((start - day_start).total_seconds() // 60)
        end_m = int((end - day_start).total_seconds() // 60)
        if end_m > start_m:
            ranges.append((start_m, end_m))
    return ranges


def _booking_ranges(business, day, staff, exclude_id=None):
    qs = Booking.objects.filter(business=business, booking_date=day, status__in=ACTIVE_BOOKING_STATUSES)
    qs = qs.filter(staff=staff) if staff is not None else qs.filter(staff__isnull=True)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    ranges = []
    for booking in qs.select_related('service'):
        start = hhmm_to_minutes(booking.start_time)
        if start is None:
            continue
        end = hhmm_to_minutes(booking.end_time)
        if end is None or end <= start:
            end = start + (booking.service.duration_minutes if booking.service else 30)
        ranges.append((start, end))
    return ranges


def busy_ranges(business, day, staff, exclude_booking_id=None):
    schedule = day_schedule(business, day)
    breaks = schedule[2] if schedule else []
    return breaks + _blocked_ranges(business, day, staff) + _booking_ranges(business, day, staff, exclude_booking_id)


def _overlaps(start, end, ranges):
    return any(start < r_end and end > r_start for r_start, r_end in ranges)


def default_staff(business):
    return business.staff.filter(is_active=True).order_by('created_at').first()


def available_slots(business, day, staff, duration):
    """All start times ('HH:MM') where a `duration`-minute appointment fits."""
    schedule = day_schedule(business, day)
    if schedule is None:
        return None
    open_m, close_m, _ = schedule
    busy = busy_ranges(business, day, staff)
    now = local_now()
    min_start = -1
    if day == now.date():
        min_start = now.hour * 60 + now.minute + TODAY_MIN_NOTICE_MINUTES
    elif day < now.date():
        return []
    step = max(5, min(SLOT_STEP_MAX, duration))
    slots, cursor = [], open_m
    while cursor + duration <= close_m:
        if cursor > min_start and not _overlaps(cursor, cursor + duration, busy):
            slots.append(minutes_to_hhmm(cursor))
        cursor += step
    return slots


def validate_slot(business, day, start_time, staff, duration, exclude_booking_id=None):
    """Raise BookingError unless [start, start+duration) is bookable. Returns end_time 'HH:MM'."""
    now = local_now()
    if day < now.date():
        raise BookingError('O‘tgan sana uchun bron qilib bo‘lmaydi.')
    if day > now.date() + timedelta(days=MAX_DAYS_AHEAD):
        raise BookingError(f'Bron faqat {MAX_DAYS_AHEAD} kun oldinga qilinishi mumkin.')
    schedule = day_schedule(business, day)
    if schedule is None:
        raise BookingError('Tanlangan kun dam olish kuni.')
    open_m, close_m, breaks = schedule
    start = hhmm_to_minutes(start_time)
    end = start + duration
    if day == now.date() and start <= now.hour * 60 + now.minute:
        raise BookingError('Bu vaqt allaqachon o‘tib ketgan.')
    if start < open_m or end > close_m:
        raise BookingError(f'Ish vaqti: {minutes_to_hhmm(open_m)} – {minutes_to_hhmm(close_m)}.')
    if _overlaps(start, end, breaks):
        raise BookingError('Tanlangan vaqt tanaffusga to‘g‘ri keladi.')
    if _overlaps(start, end, _blocked_ranges(business, day, staff)):
        raise BookingError('Tanlangan vaqt band qilingan (bloklangan).')
    if _overlaps(start, end, _booking_ranges(business, day, staff, exclude_booking_id)):
        raise BookingError('Bu vaqt hozirgina boshqa mijoz tomonidan band qilindi. Iltimos, boshqa vaqtni tanlang.')
    return minutes_to_hhmm(end)


def _lock_staff(business, staff):
    if staff is not None:
        Staff.objects.select_for_update().filter(pk=staff.pk).first()
    else:
        # No staff assigned: serialise on the business row itself so two concurrent requests
        # for the same business/slot can't both pass the overlap check (staff is NULL, so the
        # per-staff unique constraint can't catch this — see uniq_active_booking_per_business_slot_no_staff).
        Business.objects.select_for_update().filter(pk=business.pk).first()


def create_booking(*, business, service, staff, customer, day, start_time, customer_name, customer_phone):
    if business.status != BusinessStatus.APPROVED:
        raise BookingError('Ushbu muassasa hozircha bron qabul qilmaydi.')
    duration = service.duration_minutes or 30
    try:
        with transaction.atomic():
            _lock_staff(business, staff)  # serialises concurrent bookings for the same staff/business slot
            end_time = validate_slot(business, day, start_time, staff, duration)
            return Booking.objects.create(
                business=business, service=service, staff=staff, customer=customer,
                customer_name=customer_name[:255], customer_phone=customer_phone[:32],
                booking_date=day, start_time=start_time, end_time=end_time,
                total_price_uzs=service.price_uzs, status=BookingStatus.CONFIRMED,
            )
    except IntegrityError:
        raise BookingError('Bu vaqt hozirgina boshqa mijoz tomonidan band qilindi. Iltimos, boshqa vaqtni tanlang.')


def reschedule_booking(booking, *, day, start_time, staff):
    duration = booking.service.duration_minutes if booking.service else 30
    try:
        with transaction.atomic():
            _lock_staff(booking.business, staff)
            end_time = validate_slot(booking.business, day, start_time, staff, duration, exclude_booking_id=booking.id)
            booking.booking_date = day
            booking.start_time = start_time
            booking.end_time = end_time
            booking.staff = staff
            booking.status = BookingStatus.CONFIRMED
            booking.save(update_fields=['booking_date', 'start_time', 'end_time', 'staff', 'status'])
            return booking
    except IntegrityError:
        raise BookingError('Bu vaqt band. Iltimos, boshqa vaqtni tanlang.')
