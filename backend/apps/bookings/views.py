from datetime import datetime, date, timedelta
from django.utils import timezone
from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.db.models import Q

from .models import Booking, BlockedTime, BookingStatus
from .serializers import BookingSerializer, BlockedTimeSerializer
from apps.marketplace.models import Business, Service, Staff, BusinessHours
from apps.authentication.models import User
from apps.authentication.permissions import IsFounderOrAdmin, IsBusinessOwner


def get_tashkent_now():
    # UTC+5
    return timezone.now().astimezone(timezone.get_current_timezone())


class AvailableSlotsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, business_id):
        date_str = request.query_params.get('date')
        staff_id = request.query_params.get('staff_id')
        service_id = request.query_params.get('service_id')

        if not date_str:
            return Response({'slots': []})

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'slots': []})

        biz = Business.objects.filter(id=business_id).first()
        if not biz:
            return Response({'slots': []})

        # Day of week: Python 0 is Monday, 6 is Sunday
        dow = target_date.weekday()
        bh = BusinessHours.objects.filter(business=biz, day_of_week=dow).first()
        if bh and bh.is_closed:
            return Response({'slots': [], 'reason': 'Dam olish kuni'})

        open_time = bh.open_time if bh else '09:00'
        close_time = bh.close_time if bh else '18:00'

        def time_to_min(t_str):
            h, m = map(int, t_str.split(':')[:2])
            return h * 60 + m

        def min_to_time(minutes):
            return f"{minutes // 60:02d}:{minutes % 60:02d}"

        open_min = time_to_min(open_time)
        close_min = time_to_min(close_time)

        # Service duration
        duration = 30
        if service_id:
            srv = Service.objects.filter(id=service_id).first()
            if srv:
                duration = srv.duration_minutes or 30

        # Existing bookings on this date
        b_query = Booking.objects.filter(
            business=biz,
            booking_date=target_date,
            status__in=['CONFIRMED', 'PENDING', 'IN_PROGRESS']
        )
        if staff_id:
            b_query = b_query.filter(staff_id=staff_id)

        booked_ranges = []
        for b in b_query:
            b_start = time_to_min(b.start_time)
            b_end = time_to_min(b.end_time) if b.end_time else b_start + duration
            booked_ranges.append((b_start, b_end))

        # Generate standard slot intervals (every 30 or duration mins)
        interval = min(30, duration)
        now = get_tashkent_now()
        is_today = (target_date == now.date())
        current_minute = now.hour * 60 + now.minute

        slots = []
        curr = open_min
        while curr + duration <= close_min:
            # If today, skip slots in past + 15 min buffer
            if is_today and curr <= current_minute + 15:
                curr += interval
                continue

            slot_end = curr + duration
            # Check overlap
            overlaps = any(not (slot_end <= b_s or curr >= b_e) for b_s, b_e in booked_ranges)
            if not overlaps:
                slots.append(min_to_time(curr))
            curr += interval

        return Response({
            'slots': slots,
            'suggested_date': (now.date() + timedelta(days=1)).isoformat() if not slots else None
        })


class CreateBookingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        biz_id = data.get('business_id')
        service_id = data.get('service_id')
        staff_id = data.get('staff_id')
        booking_date = data.get('booking_date')
        start_time = data.get('start_time')

        biz = Business.objects.filter(id=biz_id).first()
        srv = Service.objects.filter(id=service_id).first()
        if not biz or not srv:
            return Response({'error': 'Biznes yoki xizmat topilmadi.'}, status=400)

        staff = Staff.objects.filter(id=staff_id).first() if staff_id else biz.staff.filter(is_active=True).first()

        duration = srv.duration_minutes or 30
        h, m = map(int, start_time.split(':')[:2])
        end_min = h * 60 + m + duration
        end_time = f"{end_min // 60:02d}:{end_min % 60:02d}"

        booking = Booking.objects.create(
            business=biz,
            service=srv,
            staff=staff,
            customer=request.user,
            customer_name=data.get('customer_name') or request.user.name,
            customer_phone=data.get('customer_phone') or request.user.phone or '',
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
            total_price_uzs=srv.price_uzs,
            status=BookingStatus.CONFIRMED
        )

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class CustomerBookingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status')
        qs = Booking.objects.filter(customer=request.user)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(BookingSerializer(qs, many=True).data)


class CancelBookingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        b = Booking.objects.filter(id=booking_id).first()
        if not b:
            return Response({'error': 'Buyurtma topilmadi.'}, status=404)
        if b.customer != request.user and not request.user.is_founder:
            # Check if business owner
            if b.business.owner != request.user:
                return Response({'error': 'Ruxsat berilmagan.'}, status=403)

        b.status = BookingStatus.CANCELLED
        b.cancel_reason = request.data.get('reason', 'Mijoz tomonidan bekor qilindi.')
        b.save(update_fields=['status', 'cancel_reason'])
        return Response(BookingSerializer(b).data)


class RescheduleBookingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        b = Booking.objects.filter(id=booking_id).first()
        if not b:
            return Response({'error': 'Buyurtma topilmadi.'}, status=404)
        new_date = request.data.get('booking_date')
        new_time = request.data.get('start_time')
        staff_id = request.data.get('staff_id')

        if new_date:
            b.booking_date = new_date
        if new_time:
            b.start_time = new_time
            dur = b.service.duration_minutes if b.service else 30
            h, m = map(int, new_time.split(':')[:2])
            end_min = h * 60 + m + dur
            b.end_time = f"{end_min // 60:02d}:{end_min % 60:02d}"
        if staff_id:
            stf = Staff.objects.filter(id=staff_id).first()
            if stf:
                b.staff = stf

        b.status = BookingStatus.CONFIRMED
        b.save()
        return Response(BookingSerializer(b).data)


class BusinessCalendarBookingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        biz = Business.objects.filter(owner=user).first() or Business.objects.first()
        if not biz:
            return Response([])

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        qs = Booking.objects.filter(business=biz)
        if start_date:
            qs = qs.filter(booking_date__gte=start_date)
        if end_date:
            qs = qs.filter(booking_date__lte=end_date)

        return Response(BookingSerializer(qs, many=True).data)


class BusinessBookingStatusUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        b = Booking.objects.filter(id=booking_id).first()
        if not b:
            return Response({'error': 'Buyurtma topilmadi.'}, status=404)
        new_status = request.data.get('status')
        if new_status in BookingStatus.values:
            b.status = new_status
            b.save(update_fields=['status'])
        return Response(BookingSerializer(b).data)


class BusinessBlockedTimesView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_biz(self, user):
        return Business.objects.filter(owner=user).first() or Business.objects.first()

    def get(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response([])
        bts = BlockedTime.objects.filter(business=biz)
        return Response(BlockedTimeSerializer(bts, many=True).data)

    def post(self, request):
        biz = self.get_biz(request.user)
        if not biz:
            return Response({'error': 'Biznes topilmadi'}, status=400)
        data = request.data
        staff_id = data.get('staff_id')
        staff = Staff.objects.filter(id=staff_id).first() if staff_id else None

        bt = BlockedTime.objects.create(
            business=biz,
            staff=staff,
            title=data.get('title', 'Band vaqt'),
            start_datetime=data.get('start_datetime'),
            end_datetime=data.get('end_datetime')
        )
        return Response(BlockedTimeSerializer(bt).data, status=status.HTTP_201_CREATED)


class BusinessBlockedTimeDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        BlockedTime.objects.filter(id=pk).delete()
        return Response({'success': True})


class AdminAllBookingsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        status_filter = request.query_params.get('status')
        q = request.query_params.get('q', '').strip()
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))

        qs = Booking.objects.all().select_related('business', 'service', 'staff', 'customer')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if q:
            qs = qs.filter(
                Q(customer_name__icontains=q) |
                Q(customer_phone__icontains=q) |
                Q(booking_number__icontains=q) |
                Q(business__name__icontains=q)
            )

        total = qs.count()
        offset = (page - 1) * limit
        items = qs[offset:offset + limit]

        return Response({
            'bookings': BookingSerializer(items, many=True).data,
            'total': total,
            'page': page,
            'totalPages': max(1, (total + limit - 1) // limit)
        })
