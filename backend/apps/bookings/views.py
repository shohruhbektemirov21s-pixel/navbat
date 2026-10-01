from datetime import timedelta

from django.db.models import Count, Max, Min, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status, views
from rest_framework.response import Response

from apps.authentication.permissions import IsFounderOrAdmin
from apps.core.models import log_audit
from apps.core.utils import client_ip, local_today, parse_date, parse_hhmm, parse_pagination
from apps.marketplace.models import Business, BusinessStatus, Service, Staff
from apps.marketplace.services import can_manage_business, get_user_business, is_admin

from .models import ACTIVE_BOOKING_STATUSES, BlockedTime, Booking, BookingStatus
from .serializers import BOOKING_RELATED, BlockedTimeSerializer, BookingSerializer
from .services import BookingError, available_slots, create_booking, default_staff, reschedule_booking

UZ_WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def bookings_qs():
    return Booking.objects.select_related(*BOOKING_RELATED)


def resolve_staff(business, staff_id):
    if staff_id:
        staff = Staff.objects.filter(id=staff_id, business=business, is_active=True).first()
        if not staff:
            raise BookingError('Mutaxassis ushbu muassasaga tegishli emas.')
        return staff
    return default_staff(business)


def resolve_service(business, service_id):
    service = Service.objects.filter(id=service_id or '', business=business, is_active=True).first()
    if not service:
        raise BookingError('Xizmat topilmadi yoki ushbu muassasaga tegishli emas.')
    return service


class AvailableSlotsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, business_id):
        params = request.query_params
        if not params.get('date'):
            return Response({'slots': []})
        day = parse_date(params.get('date'), 'date')
        biz = Business.objects.filter(Q(id=business_id) | Q(slug=business_id), status=BusinessStatus.APPROVED).first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        staff = resolve_staff(biz, params.get('staff_id'))
        duration = 30
        if params.get('service_id'):
            duration = resolve_service(biz, params.get('service_id')).duration_minutes or 30

        slots = available_slots(biz, day, staff, duration)
        reason = 'Dam olish kuni' if slots is None else None
        slots = slots or []
        suggested = None
        if not slots:
            probe = max(day, local_today()) + timedelta(days=1)
            for _ in range(14):
                if available_slots(biz, probe, staff, duration):
                    suggested = probe
                    break
                probe += timedelta(days=1)
        payload = {
            'slots': slots,
            'suggested_date': suggested.isoformat() if suggested else None,
            'suggested_date_formatted': f'{suggested.strftime("%d.%m.%Y")} ({UZ_WEEKDAYS[suggested.weekday()]})' if suggested else None,
        }
        if reason:
            payload['reason'] = reason
        return Response(payload)


class CreateBookingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        biz = Business.objects.filter(id=data.get('business_id') or '').first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        if not data.get('booking_date') or not data.get('start_time'):
            return error('Sana (booking_date) va vaqt (start_time) kiritilishi shart.')
        day = parse_date(data.get('booking_date'), 'booking_date')
        start_time = parse_hhmm(data.get('start_time'), 'start_time')
        service = resolve_service(biz, data.get('service_id'))
        staff = resolve_staff(biz, data.get('staff_id'))

        booking = create_booking(
            business=biz, service=service, staff=staff, customer=request.user, day=day, start_time=start_time,
            customer_name=str(data.get('customer_name') or '').strip() or request.user.name,
            customer_phone=str(data.get('customer_phone') or '').strip() or (request.user.phone or ''),
        )
        notify_business_new_booking(booking)
        payload = BookingSerializer(bookings_qs().get(pk=booking.pk)).data
        return Response({**payload, 'success': True, 'booking': payload,
                         'message': 'Bron muvaffaqiyatli yaratildi!'}, status=status.HTTP_201_CREATED)


def notify_business_new_booking(booking):
    from apps.notifications.services import business_chat_id, esc, notify_user, send_telegram_message

    biz = booking.business
    notify_user(biz.owner, f'Yangi bron #{booking.booking_number}',
                f'{booking.customer_name}: {booking.booking_date} {booking.start_time} ({booking.service.name})', 'NEW_BOOKING')
    chat = business_chat_id(biz)
    if chat:
        send_telegram_message(chat, (
            f'⚡️ <b>Yangi bron #{esc(booking.booking_number)}</b>\n━━━━━━━━━━━━━━━━\n'
            f'👤 {esc(booking.customer_name)} ({esc(booking.customer_phone)})\n'
            f'🩺 {esc(booking.service.name)}\n📅 {booking.booking_date} {esc(booking.start_time)}'
        ))


class CustomerBookingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = bookings_qs().filter(customer=request.user)
        status_filter = request.query_params.get('status')
        if status_filter:
            if status_filter not in BookingStatus.values:
                return error('Noto‘g‘ri status.')
            qs = qs.filter(status=status_filter)
        return Response(BookingSerializer(qs, many=True).data)


def get_booking_for(user, booking_id, *, allow_customer=True):
    """Return the booking if `user` is its customer, manages its business, or is an admin."""
    booking = bookings_qs().filter(id=booking_id).first()
    if not booking:
        return None, error('Bron topilmadi.', status.HTTP_404_NOT_FOUND)
    if allow_customer and booking.customer_id == user.id:
        return booking, None
    if can_manage_business(user, booking.business):
        return booking, None
    return None, error('Ruxsat berilmagan.', status.HTTP_403_FORBIDDEN)


class CancelBookingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        booking, err = get_booking_for(request.user, booking_id)
        if err:
            return err
        if booking.status not in ACTIVE_BOOKING_STATUSES:
            return error('Faqat faol bronni bekor qilish mumkin.')
        by_customer = booking.customer_id == request.user.id
        booking.status = BookingStatus.CANCELLED
        booking.cancel_reason = str(request.data.get('reason') or '').strip()[:1000] or (
            'Mijoz tomonidan bekor qilindi.' if by_customer else 'Muassasa tomonidan bekor qilindi.')
        booking.save(update_fields=['status', 'cancel_reason'])
        log_audit(request.user, 'BOOKING_CANCELLED', 'BOOKING', booking.id, booking.cancel_reason, client_ip(request))
        return Response(BookingSerializer(booking).data)


class RescheduleBookingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        booking, err = get_booking_for(request.user, booking_id)
        if err:
            return err
        if booking.status not in ACTIVE_BOOKING_STATUSES:
            return error('Faqat faol bronning vaqtini o‘zgartirish mumkin.')
        data = request.data
        day = parse_date(data.get('booking_date'), 'booking_date') if data.get('booking_date') else booking.booking_date
        start_time = parse_hhmm(data.get('start_time'), 'start_time') if data.get('start_time') else booking.start_time
        staff = resolve_staff(booking.business, data.get('staff_id')) if data.get('staff_id') else booking.staff
        reschedule_booking(booking, day=day, start_time=start_time, staff=staff)
        log_audit(request.user, 'BOOKING_RESCHEDULED', 'BOOKING', booking.id, f'{day} {start_time}', client_ip(request))
        return Response(BookingSerializer(bookings_qs().get(pk=booking.pk)).data)


class BusinessCalendarBookingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        biz = get_user_business(request.user)
        qs = bookings_qs().filter(business=biz)
        if request.query_params.get('start_date'):
            qs = qs.filter(booking_date__gte=parse_date(request.query_params['start_date'], 'start_date'))
        if request.query_params.get('end_date'):
            qs = qs.filter(booking_date__lte=parse_date(request.query_params['end_date'], 'end_date'))
        return Response(BookingSerializer(qs, many=True).data)


class BusinessBookingStatusUpdateView(views.APIView):
    """Used by both /business/bookings/<id>/status and /admin/bookings/<id>/status."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        booking, err = get_booking_for(request.user, booking_id, allow_customer=False)
        if err:
            return err
        new_status = request.data.get('status')
        if new_status not in BookingStatus.values:
            return error('Noto‘g‘ri status qiymati.')
        if new_status in ACTIVE_BOOKING_STATUSES and booking.status not in ACTIVE_BOOKING_STATUSES:
            # Re-activating: make sure the slot is still free.
            from .services import validate_slot
            validate_slot(booking.business, booking.booking_date, booking.start_time, booking.staff,
                          booking.service.duration_minutes or 30, exclude_booking_id=booking.id)
        old = booking.status
        booking.status = new_status
        booking.save(update_fields=['status'])
        log_audit(request.user, 'BOOKING_STATUS_UPDATED', 'BOOKING', booking.id, f'{old} -> {new_status}',
                  client_ip(request), old_value=old, new_value=new_status)
        return Response({**BookingSerializer(booking).data, 'success': True})


class SendBookingReminderView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        from apps.notifications.services import esc, notify_user, send_telegram_message

        booking, err = get_booking_for(request.user, booking_id, allow_customer=False)
        if err:
            return err
        customer = booking.customer
        chat_id = customer.telegram_chat_id if (customer and customer.telegram_notifications_enabled) else None
        if not chat_id:
            return error('Mijoz Telegram botga ulanmagan, eslatma yuborib bo‘lmaydi.')
        biz = booking.business
        sent = send_telegram_message(chat_id, (
            '⏰ <b>Eslatma: qabulingiz yaqinlashmoqda!</b>\n━━━━━━━━━━━━━━━━\n'
            f'📋 Bron raqami: <b>#{esc(booking.booking_number)}</b>\n'
            f'🏢 Muassasa: <b>{esc(biz.name)}</b>\n'
            f'🩺 Xizmat: <b>{esc(booking.service.name)}</b>\n'
            f'👨‍⚕️ Mutaxassis: <b>{esc(booking.staff.name if booking.staff else "—")}</b>\n'
            f'📅 Sana: <b>{booking.booking_date}</b>\n⏰ Vaqt: <b>{esc(booking.start_time)} - {esc(booking.end_time)}</b>\n'
            f'📍 Manzil: <b>{esc(biz.address)}</b>'
        ))
        notify_user(customer, f'Eslatma: bron #{booking.booking_number}',
                    f'{biz.name}: {booking.booking_date} soat {booking.start_time}.', 'BOOKING_REMINDER')
        if not sent:
            return error('Telegram xabarini yuborib bo‘lmadi. Keyinroq urinib ko‘ring.', status.HTTP_502_BAD_GATEWAY)
        booking.reminder_sent = True
        booking.save(update_fields=['reminder_sent'])
        log_audit(request.user, 'REMINDER_SENT', 'BOOKING', booking.id, f'#{booking.booking_number}', client_ip(request))
        return Response({'success': True, 'message': 'Eslatma muvaffaqiyatli yuborildi'})


class BusinessCRMCustomersView(views.APIView):
    """Aggregated customers of the caller's business (CRMCustomer shape)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        biz = get_user_business(request.user)
        today = local_today()
        qs = Booking.objects.filter(business=biz)
        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(Q(customer_name__icontains=q) | Q(customer_phone__icontains=q) | Q(customer__email__icontains=q))
        rows = (
            qs.values('customer_id', 'customer__email')
            .annotate(
                customer_name=Max('customer_name'),
                customer_phone=Max('customer_phone'),
                total_bookings=Count('id'),
                completed_visits=Count('id', filter=Q(status=BookingStatus.COMPLETED)),
                cancelled_count=Count('id', filter=Q(status=BookingStatus.CANCELLED)),
                no_show_count=Count('id', filter=Q(status=BookingStatus.NO_SHOW)),
                total_spent_uzs=Sum('total_price_uzs', filter=Q(status=BookingStatus.COMPLETED)),
                last_visit_date=Max('booking_date', filter=Q(booking_date__lte=today)),
                next_booking_date=Min('booking_date', filter=Q(booking_date__gte=today, status__in=ACTIVE_BOOKING_STATUSES)),
            )
            .order_by('-last_visit_date')
        )
        return Response([
            {
                'customer_id': r['customer_id'],
                'customer_name': r['customer_name'],
                'customer_phone': r['customer_phone'],
                'customer_email': r['customer__email'],
                'total_bookings': r['total_bookings'],
                'completed_visits': r['completed_visits'],
                'cancelled_count': r['cancelled_count'],
                'no_show_count': r['no_show_count'],
                'total_spent_uzs': r['total_spent_uzs'] or 0,
                'last_visit_date': r['last_visit_date'].isoformat() if r['last_visit_date'] else None,
                'next_booking_date': r['next_booking_date'].isoformat() if r['next_booking_date'] else None,
            }
            for r in rows
        ])


def _parse_block_range(data):
    start = parse_datetime(str(data.get('start_datetime') or ''))
    end = parse_datetime(str(data.get('end_datetime') or ''))
    if not start or not end:
        raise BookingError('start_datetime va end_datetime ISO formatida kiritilishi shart.')
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(start, tz) if timezone.is_naive(start) else start
    end = timezone.make_aware(end, tz) if timezone.is_naive(end) else end
    if end <= start:
        raise BookingError('Tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak.')
    return start, end


class BusinessBlockedTimesView(views.APIView):
    """/business/blocked-times (own business) and /admin/blocked-times (admins, optional ?business_id)."""
    permission_classes = [permissions.IsAuthenticated]
    admin_mode = False

    def _business(self, request, business_id=None):
        if self.admin_mode:
            if not is_admin(request.user):
                raise BookingError('Ruxsat berilmagan.')
            if business_id:
                return get_user_business(request.user, business_id)
            return None
        return get_user_business(request.user)

    def get(self, request):
        biz = self._business(request, request.query_params.get('business_id'))
        qs = BlockedTime.objects.select_related('staff')
        if biz is not None:
            qs = qs.filter(business=biz)
        return Response(BlockedTimeSerializer(qs.order_by('-start_datetime')[:500], many=True).data)

    def post(self, request):
        data = request.data
        biz = self._business(request, data.get('business_id'))
        if biz is None:
            return error('business_id kiritilishi shart.')
        start, end = _parse_block_range(data)
        staff = None
        if data.get('staff_id'):
            staff = Staff.objects.filter(id=data['staff_id'], business=biz).first()
            if not staff:
                return error('Mutaxassis ushbu muassasaga tegishli emas.')
        block = BlockedTime.objects.create(
            business=biz, staff=staff, title=(str(data.get('title') or '').strip() or 'Band vaqt')[:255],
            start_datetime=start, end_datetime=end,
        )
        return Response(BlockedTimeSerializer(block).data, status=status.HTTP_201_CREATED)


class AdminBlockedTimesView(BusinessBlockedTimesView):
    permission_classes = [IsFounderOrAdmin]
    admin_mode = True


class BusinessBlockedTimeDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        block = BlockedTime.objects.select_related('business').filter(id=pk).first()
        if not block:
            return error('Band vaqt topilmadi.', status.HTTP_404_NOT_FOUND)
        if not can_manage_business(request.user, block.business, owner_only=False):
            return error('Ruxsat berilmagan.', status.HTTP_403_FORBIDDEN)
        block.delete()
        return Response({'success': True})


class AdminAllBookingsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        params = request.query_params
        page, limit = parse_pagination(params)
        qs = bookings_qs()
        status_filter = params.get('status')
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)
        q = params.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(customer_name__icontains=q) | Q(customer_phone__icontains=q) |
                Q(booking_number__icontains=q) | Q(business__name__icontains=q)
            )
        total = qs.count()
        offset = (page - 1) * limit
        return Response({
            'bookings': BookingSerializer(qs[offset:offset + limit], many=True).data,
            'total': total,
            'page': page,
            'totalPages': max(1, (total + limit - 1) // limit),
        })
