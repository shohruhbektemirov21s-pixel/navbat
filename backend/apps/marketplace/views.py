from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, status, views
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.authentication.permissions import IsFounderOrAdmin
from apps.core.models import log_audit
from apps.core.utils import client_ip, hhmm_to_minutes, parse_float, parse_hhmm, parse_int, parse_pagination

from .application_models import BusinessApplication, BusinessApplicationStatus
from .models import Business, BusinessHours, BusinessStatus, Category, City, Review, SavedBusiness, Service, Staff
from .serializers import (
    AdminBusinessSerializer, AdminReviewSerializer, BusinessHoursSerializer, BusinessListSerializer,
    BusinessManageSerializer, CategorySerializer, CitySerializer, ReviewSerializer, ServiceSerializer,
    StaffSerializer, business_application_payload, business_applications_queryset, with_business_stats,
)
from .services import (
    approve_business_application, can_manage_business, find_user_business, get_user_business,
    reject_business_application,
)


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def business_stats_qs():
    return with_business_stats(Business.objects.all())


# ---------------------------------------------------------------------------
# Public catalogue
# ---------------------------------------------------------------------------
class CategoryListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(CategorySerializer(Category.objects.filter(active=True).order_by('name'), many=True).data)


class CityListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(CitySerializer(City.objects.all().order_by('name'), many=True).data)


class BusinessListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        params = request.query_params
        q = params.get('q', '').strip()
        category = params.get('category', '').strip()
        city = params.get('city', '').strip()
        sort = params.get('sort', 'popular')
        page, limit = parse_pagination(params)
        user_lat = parse_float(params.get('lat'), 'lat')
        user_lng = parse_float(params.get('lng'), 'lng')

        qs = business_stats_qs().filter(status=BusinessStatus.APPROVED)
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(address__icontains=q))
        if category and category != 'all':
            qs = qs.filter(Q(category__slug=category) | Q(category__id=category))
        if city and city != 'all':
            qs = qs.filter(Q(city__name__icontains=city) | Q(city__id=city))

        if sort == 'rating':
            from django.db.models import F
            qs = qs.order_by(F('_avg_rating').desc(nulls_last=True), '-_review_count')
        elif sort == 'newest':
            qs = qs.order_by('-created_at')
        else:
            qs = qs.order_by('-is_sponsored', '-_review_count', '-created_at')

        context = {'user_lat': user_lat, 'user_lng': user_lng}
        total = qs.count()
        offset = (page - 1) * limit
        if sort == 'distance' and user_lat is not None and user_lng is not None:
            data = BusinessListSerializer(list(qs), many=True, context=context).data
            data = sorted(data, key=lambda b: (b['distance_km'] is None, b['distance_km'] or 0))[offset:offset + limit]
        else:
            data = BusinessListSerializer(qs[offset:offset + limit], many=True, context=context).data

        return Response({
            'items': data,
            'total': total,
            'page': page,
            'limit': limit,
            'totalPages': max(1, (total + limit - 1) // limit),
            'user_coords': {'lat': user_lat, 'lng': user_lng} if user_lat is not None and user_lng is not None else None,
        })


class BusinessDetailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        biz = business_stats_qs().filter(Q(slug=slug) | Q(id=slug)).first()
        if not biz or (biz.status != BusinessStatus.APPROVED and not can_manage_business(request.user, biz)):
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)

        context = {
            'user_lat': parse_float(request.query_params.get('lat'), 'lat'),
            'user_lng': parse_float(request.query_params.get('lng'), 'lng'),
        }
        reviews = biz.reviews.select_related('customer').order_by('-created_at')[:20]
        return Response({
            'business': BusinessListSerializer(biz, context=context).data,
            'services': ServiceSerializer(biz.services.filter(is_active=True).order_by('price_uzs'), many=True).data,
            'staff': StaffSerializer(biz.staff.filter(is_active=True).prefetch_related('services'), many=True).data,
            'hours': BusinessHoursSerializer(biz.hours.all(), many=True).data,
            'reviews': ReviewSerializer(reviews, many=True).data,
        })


# ---------------------------------------------------------------------------
# Business management (owner / staff)
# ---------------------------------------------------------------------------
class BusinessCurrentView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.bookings.models import Booking
        from apps.core.utils import local_today
        from apps.queues.models import QueueEntry

        biz = find_user_business(request.user)
        if not biz:
            return Response({'business': None, 'stats': {}})
        biz = business_stats_qs().get(pk=biz.pk)
        today = local_today()
        bookings = Booking.objects.filter(business=biz)
        return Response({
            'business': BusinessManageSerializer(biz).data,
            'stats': {
                'totalBookings': bookings.count(),
                'todayBookings': bookings.filter(booking_date=today).count(),
                'totalQueues': QueueEntry.objects.filter(business=biz).count(),
                'todayQueues': QueueEntry.objects.filter(business=biz, queue_date=today).count(),
                'activeServices': biz.services.filter(is_active=True).count(),
                'activeStaff': biz.staff.filter(is_active=True).count(),
            },
        })


class BusinessServicesView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        biz = get_user_business(request.user)
        return Response(ServiceSerializer(Service.objects.filter(business=biz).order_by('price_uzs'), many=True).data)

    def post(self, request):
        biz = get_user_business(request.user, owner_only=True)
        data = request.data
        name = str(data.get('name') or '').strip()
        if not name:
            return error('Xizmat nomini kiriting.')
        service = Service.objects.create(
            business=biz,
            name=name[:255],
            description=str(data.get('description') or '')[:2000],
            price_uzs=parse_int(data.get('price_uzs'), default=0, min_value=0, max_value=1_000_000_000, field='price_uzs'),
            duration_minutes=parse_int(data.get('duration_minutes'), default=30, min_value=5, max_value=720,
                                       field='duration_minutes'),
            is_active=True,
        )
        return Response(ServiceSerializer(service).data, status=status.HTTP_201_CREATED)


class BusinessServiceDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        biz = get_user_business(request.user, owner_only=True)
        service = Service.objects.filter(id=pk, business=biz).first()
        if not service:
            return error('Xizmat topilmadi.', status.HTTP_404_NOT_FOUND)
        if service.bookings.exists():
            # Keep booking history intact: deactivate instead of deleting.
            service.is_active = False
            service.save(update_fields=['is_active'])
        else:
            service.delete()
        return Response({'success': True})


class BusinessStaffView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        biz = get_user_business(request.user)
        staff = Staff.objects.filter(business=biz).prefetch_related('services').order_by('created_at')
        return Response(StaffSerializer(staff, many=True).data)

    def post(self, request):
        from apps.subscriptions.models import SubscriptionPlan

        biz = get_user_business(request.user, owner_only=True)
        data = request.data
        name = str(data.get('name') or '').strip()
        if not name:
            return error('Xodim ismini kiriting.')
        plan = SubscriptionPlan.objects.filter(code=biz.subscription_plan_code).first()
        if plan and plan.max_staff > 0 and biz.staff.filter(is_active=True).count() >= plan.max_staff:
            return error(f'Sizning tarifingizda ({plan.name}) maksimal {plan.max_staff} ta xodim ruxsat etilgan.',
                         status.HTTP_403_FORBIDDEN)
        service_ids = data.get('service_ids') or []
        if isinstance(service_ids, str):
            service_ids = [s.strip() for s in service_ids.split(',') if s.strip()]
        if not isinstance(service_ids, list):
            return error('service_ids massiv bo‘lishi kerak.')
        services = list(Service.objects.filter(id__in=service_ids, business=biz))
        if len(services) != len(set(service_ids)):
            return error('Ba’zi xizmatlar ushbu biznesga tegishli emas.')

        with transaction.atomic():
            staff = Staff.objects.create(
                business=biz, name=name[:255], title=(str(data.get('title') or '').strip() or 'Mutaxassis')[:128],
                phone=str(data.get('phone') or '')[:32], avatar_url=str(data.get('avatar_url') or '')[:500], is_active=True,
            )
            staff.services.set(services or list(biz.services.filter(is_active=True)))
        return Response(StaffSerializer(staff).data, status=status.HTTP_201_CREATED)


def validate_hours_row(row):
    try:
        dow = int(row.get('day_of_week'))
    except (TypeError, ValueError):
        raise ValidationError({'error': 'day_of_week 0..6 oralig‘ida bo‘lishi kerak.'})
    if not 0 <= dow <= 6:
        raise ValidationError({'error': 'day_of_week 0..6 oralig‘ida bo‘lishi kerak.'})
    is_closed = bool(row.get('is_closed')) and str(row.get('is_closed')) not in ('0', 'false', 'False')
    open_time = parse_hhmm(row.get('open_time') or '09:00', 'open_time')
    close_time = parse_hhmm(row.get('close_time') or '18:00', 'close_time')
    if not is_closed and hhmm_to_minutes(open_time) >= hhmm_to_minutes(close_time):
        raise ValidationError({'error': 'Ish boshlanish vaqti tugash vaqtidan oldin bo‘lishi kerak.'})
    break_start = (row.get('break_start') or '').strip()
    break_end = (row.get('break_end') or '').strip()
    if break_start or break_end:
        break_start = parse_hhmm(break_start, 'break_start')
        break_end = parse_hhmm(break_end, 'break_end')
        if hhmm_to_minutes(break_start) >= hhmm_to_minutes(break_end):
            raise ValidationError({'error': 'Tanaffus boshlanishi tugashidan oldin bo‘lishi kerak.'})
    return dow, {'open_time': open_time, 'close_time': close_time, 'is_closed': is_closed,
                 'break_start': break_start, 'break_end': break_end}


class BusinessHoursView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        biz = get_user_business(request.user)
        return Response(BusinessHoursSerializer(BusinessHours.objects.filter(business=biz).order_by('day_of_week'), many=True).data)

    def put(self, request):
        biz = get_user_business(request.user, owner_only=True)
        hours_data = request.data.get('hours', [])
        if not isinstance(hours_data, list):
            return error('hours massiv bo‘lishi kerak.')
        rows = [validate_hours_row(h) for h in hours_data if isinstance(h, dict)]
        with transaction.atomic():
            for dow, defaults in rows:
                BusinessHours.objects.update_or_create(business=biz, day_of_week=dow, defaults=defaults)
        log_audit(request.user, 'BUSINESS_HOURS_UPDATED', 'BUSINESS', biz.id, 'Ish vaqtlari yangilandi', client_ip(request))
        hours = BusinessHours.objects.filter(business=biz).order_by('day_of_week')
        return Response(BusinessHoursSerializer(hours, many=True).data)


class BusinessProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    EDITABLE = {'name': 255, 'address': 255, 'district': 128, 'phone': 32, 'description': 5000, 'logo_url': 500}

    def get(self, request):
        biz = get_user_business(request.user)
        return Response(BusinessManageSerializer(business_stats_qs().get(pk=biz.pk)).data)

    def put(self, request):
        biz = get_user_business(request.user, owner_only=True)
        data = request.data
        changed = []
        for field, max_len in self.EDITABLE.items():
            if field in data:
                value = str(data.get(field) or '').strip()
                if field in ('name', 'address', 'phone') and not value:
                    return error(f"'{field}' bo‘sh bo‘lishi mumkin emas.")
                setattr(biz, field, value[:max_len])
                changed.append(field)
        if 'telegram_chat_id' in data:
            from apps.authentication.views import clean_chat_id
            biz.telegram_chat_id = clean_chat_id(data.get('telegram_chat_id'))
            changed.append('telegram_chat_id')
        if changed:
            biz.save(update_fields=changed)
            log_audit(request.user, 'BUSINESS_PROFILE_UPDATED', 'BUSINESS', biz.id, ', '.join(changed), client_ip(request),
                      target_name=biz.name)
        payload = BusinessManageSerializer(business_stats_qs().get(pk=biz.pk)).data
        return Response({**payload, 'success': True, 'message': 'Ma’lumotlar muvaffaqiyatli saqlandi'})


class BusinessTelegramSettingsView(views.APIView):
    """POST {telegram_chat_id, telegram_channel_or_group?, send_test?} — owner only."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.authentication.views import clean_chat_id
        from apps.notifications.services import esc, send_telegram_message

        biz = get_user_business(request.user, owner_only=True)
        biz.telegram_chat_id = clean_chat_id(request.data.get('telegram_chat_id'))
        biz.telegram_channel_or_group = clean_chat_id(request.data.get('telegram_channel_or_group'))
        biz.save(update_fields=['telegram_chat_id', 'telegram_channel_or_group'])
        log_audit(request.user, 'BUSINESS_TELEGRAM_UPDATED', 'BUSINESS', biz.id, 'Telegram sozlamalari yangilandi',
                  client_ip(request), target_name=biz.name)

        test_result = None
        target = biz.telegram_channel_or_group or biz.telegram_chat_id
        send_test = request.data.get('send_test', True)
        if target and send_test and str(send_test).lower() not in ('0', 'false'):
            test_result = {'success': send_telegram_message(target, (
                '🚀 <b>NavbatBor: Telegram bildirishnomalari ulandi!</b>\n━━━━━━━━━━━━━━━━\n'
                f'🏢 Muassasa: <b>{esc(biz.name)}</b>\nEndi yangi bron va navbatlar shu yerga yuboriladi.'
            ))}
        return Response({'success': True, 'testResult': test_result,
                         'business': BusinessManageSerializer(business_stats_qs().get(pk=biz.pk)).data,
                         'message': 'Telegram sozlamalari saqlandi.'})


# ---------------------------------------------------------------------------
# Customer favourites & reviews
# ---------------------------------------------------------------------------
class CustomerFavoritesView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        saved = {s.business_id: s.created_at for s in SavedBusiness.objects.filter(user=request.user)}
        businesses = business_stats_qs().filter(id__in=saved.keys())
        data = BusinessListSerializer(businesses, many=True).data
        for item in data:
            item['saved_at'] = saved[item['id']].isoformat()
        data.sort(key=lambda b: b['saved_at'], reverse=True)
        return Response(data)


class CustomerFavoriteIdsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(list(SavedBusiness.objects.filter(user=request.user).values_list('business_id', flat=True)))


class CustomerFavoriteToggleView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, business_id):
        saved = SavedBusiness.objects.filter(user=request.user, business_id=business_id).first()
        if saved:
            saved.delete()
            return Response({'isSaved': False})
        biz = Business.objects.filter(id=business_id, status=BusinessStatus.APPROVED).first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        SavedBusiness.objects.get_or_create(user=request.user, business=biz)
        return Response({'isSaved': True})


class ReviewCreateView(views.APIView):
    """Create a review. With `booking_id` the booking must be the caller's own COMPLETED booking."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.bookings.models import Booking, BookingStatus

        data = request.data
        rating = parse_int(data.get('rating'), default=5, min_value=1, max_value=5, field='rating')
        comment = str(data.get('comment') or '').strip()[:2000]
        booking = None
        booking_id = data.get('booking_id')
        if booking_id:
            booking = Booking.objects.select_related('business').filter(id=booking_id, customer=request.user).first()
            if not booking:
                return error('Bron topilmadi.', status.HTTP_404_NOT_FOUND)
            if booking.status != BookingStatus.COMPLETED:
                return error('Faqat yakunlangan tashrif uchun sharh qoldirish mumkin.')
            if Review.objects.filter(booking=booking).exists():
                return error('Bu bron uchun sharh allaqachon qoldirilgan.')
            biz = booking.business
        else:
            biz = Business.objects.filter(id=data.get('business_id') or '', status=BusinessStatus.APPROVED).first()
            if not biz:
                return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
            if not Booking.objects.filter(business=biz, customer=request.user, status=BookingStatus.COMPLETED).exists():
                return error('Sharh qoldirish uchun ushbu muassasada kamida bitta yakunlangan tashrifingiz bo‘lishi kerak.',
                             status.HTTP_403_FORBIDDEN)
        review = Review.objects.create(business=biz, customer=request.user, booking=booking, rating=rating, comment=comment)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
class AdminBusinessesListView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        from django.db.models import Count, Sum

        bizs = list(business_stats_qs().order_by('-created_at'))
        from apps.bookings.models import Booking
        booking_stats = {
            row['business_id']: row for row in Booking.objects.values('business_id').annotate(
                total=Count('id'), completed=Count('id', filter=Q(status='COMPLETED')),
                revenue=Sum('total_price_uzs', filter=Q(status='COMPLETED')),
            )
        }
        data = AdminBusinessSerializer(bizs, many=True).data
        for item in data:
            stats = booking_stats.get(item['id'], {})
            item['total_bookings'] = stats.get('total', 0)
            item['completed_bookings'] = stats.get('completed', 0)
            item['total_revenue'] = stats.get('revenue') or 0
        return Response(data)


class AdminBusinessStatusUpdateView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, business_id):
        biz = Business.objects.select_related('owner').filter(id=business_id).first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        return Response(apply_business_status(biz, request))


def apply_business_status(biz, request):
    """Shared by admin and partner endpoints: change status / verification and notify the owner."""
    from apps.notifications.services import business_chat_id, esc, notify_user, send_telegram_message

    new_status = request.data.get('status')
    is_verified = request.data.get('is_verified')
    reason = str(request.data.get('reason') or '').strip()[:500]
    if new_status and new_status not in BusinessStatus.values:
        raise ValidationError({'error': 'Noto‘g‘ri status qiymati.'})
    old_status = biz.status
    fields = []
    if new_status:
        biz.status = new_status
        fields.append('status')
        if new_status == BusinessStatus.APPROVED and is_verified is None:
            biz.is_verified = True
            fields.append('is_verified')
    if is_verified is not None:
        biz.is_verified = bool(is_verified) and str(is_verified).lower() not in ('0', 'false')
        fields.append('is_verified')
    if fields:
        biz.save(update_fields=list(set(fields)))
        log_audit(request.user, 'BUSINESS_STATUS_UPDATED', 'BUSINESS', biz.id,
                  f'{biz.name}: {old_status} -> {biz.status}' + (f' ({reason})' if reason else ''),
                  client_ip(request), target_name=biz.name, old_value=old_status, new_value=biz.status)
    if new_status and new_status != old_status:
        titles = {
            'APPROVED': ('Biznesingiz tasdiqlandi', f'"{biz.name}" NavbatBor katalogida ko‘rinadi.'),
            'REJECTED': ('Biznes arizasi rad etildi', f'"{biz.name}" arizasi tasdiqlanmadi.'),
            'SUSPENDED': ('Biznes faoliyati to‘xtatildi', f'"{biz.name}" faoliyati vaqtincha to‘xtatildi.'),
            'PENDING': ('Biznes holati yangilandi', f'"{biz.name}" qayta ko‘rib chiqilmoqda.'),
        }
        title, msg = titles.get(new_status, ('Biznes holati yangilandi', biz.name))
        if reason:
            msg = f'{msg} Sabab: {reason}'
        notify_user(biz.owner, title, msg, 'BUSINESS_STATUS')
        chat = business_chat_id(biz)
        if chat:
            send_telegram_message(chat, f'📢 <b>{esc(title)}</b>\n━━━━━━━━━━━━━━━━\n{esc(msg)}')
    return {**BusinessListSerializer(biz).data, 'status': biz.status, 'success': True}


class AdminReviewsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        reviews = Review.objects.select_related('business', 'customer').order_by('-created_at')[:500]
        return Response(AdminReviewSerializer(reviews, many=True).data)


class AdminReviewDeleteView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, review_id):
        review = Review.objects.select_related('business').filter(id=review_id).first()
        if not review:
            return error('Sharh topilmadi.', status.HTTP_404_NOT_FOUND)
        biz_name = review.business.name
        review.delete()
        log_audit(request.user, 'ADMIN_REVIEW_DELETED', 'REVIEW', review_id, 'Sharh o‘chirildi', client_ip(request),
                  target_name=biz_name)
        return Response({'success': True})


# ---------------------------------------------------------------------------
# Admin: Telegram-bot business applications (replaces the old self-service web form)
# ---------------------------------------------------------------------------
class AdminBusinessApplicationsListView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        status_param = (request.query_params.get('status') or 'PENDING').strip().upper()
        qs = business_applications_queryset()
        if status_param != 'ALL':
            if status_param not in BusinessApplicationStatus.values:
                return error('Noto‘g‘ri status qiymati.')
            qs = qs.filter(status=status_param)
        qs = qs.order_by('-created_at')
        return Response([business_application_payload(app) for app in qs])


class AdminBusinessApplicationApproveView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, application_id):
        with transaction.atomic():
            application = BusinessApplication.objects.select_for_update().filter(id=application_id).first()
            if not application:
                return error('Ariza topilmadi.', status.HTTP_404_NOT_FOUND)
            if application.status != BusinessApplicationStatus.PENDING:
                return error('Bu ariza allaqachon ko‘rib chiqilgan.')
            try:
                business = approve_business_application(application, request.user)
            except ValueError as exc:
                return error(str(exc))
        log_audit(request.user, 'BUSINESS_APPLICATION_APPROVED', 'BUSINESS_APPLICATION', application.id,
                  f'{application.name} -> {business.id}', client_ip(request), target_name=application.name)
        return Response({'success': True, 'business_id': business.id, 'business_slug': business.slug})


class AdminBusinessApplicationRejectView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, application_id):
        reason = str(request.data.get('reason') or '').strip()
        if not reason:
            return error('Rad etish sababini kiriting.')
        with transaction.atomic():
            application = BusinessApplication.objects.select_for_update().filter(id=application_id).first()
            if not application:
                return error('Ariza topilmadi.', status.HTTP_404_NOT_FOUND)
            if application.status != BusinessApplicationStatus.PENDING:
                return error('Bu ariza allaqachon ko‘rib chiqilgan.')
            reject_business_application(application, request.user, reason)
        log_audit(request.user, 'BUSINESS_APPLICATION_REJECTED', 'BUSINESS_APPLICATION', application.id,
                  f'{application.name}: {reason}', client_ip(request), target_name=application.name)
        return Response({'success': True})
