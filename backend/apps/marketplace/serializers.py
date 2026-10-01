import math

from django.db.models import Avg, Count, IntegerField, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce
from rest_framework import serializers

from apps.core.utils import hhmm_to_minutes, js_weekday, local_now, local_today

from .models import Business, BusinessHours, Category, City, Review, Service, Staff

ACTIVE_QUEUE = ('WAITING', 'CALLED', 'SERVING')


def _count_subquery(model_qs, field='pk'):
    return Coalesce(
        Subquery(
            model_qs.order_by().values('business').annotate(c=Count(field)).values('c')[:1],
            output_field=IntegerField(),
        ),
        Value(0),
    )


def with_business_stats(qs):
    """Annotate aggregates used by BusinessListSerializer with constant query count (no N+1)."""
    from apps.queues.models import QueueEntry

    reviews = Review.objects.filter(business=OuterRef('pk'))
    return (
        qs.select_related('category', 'city', 'owner')
        .prefetch_related(Prefetch('hours', queryset=BusinessHours.objects.order_by('day_of_week')))
        .annotate(
            _avg_rating=Subquery(
                reviews.order_by().values('business').annotate(a=Avg('rating')).values('a')[:1]
            ),
            _review_count=_count_subquery(reviews),
            _service_count=_count_subquery(Service.objects.filter(business=OuterRef('pk'), is_active=True)),
            _active_queue_count=_count_subquery(
                QueueEntry.objects.filter(business=OuterRef('pk'), status__in=ACTIVE_QUEUE, queue_date=local_today())
            ),
        )
    )


def compute_is_open(hours_list, now=None):
    """Open right now in Asia/Tashkent, based on today's working hours and break."""
    now = now or local_now()
    today = next((h for h in hours_list if h.day_of_week == js_weekday(now.date())), None)
    if today is None or today.is_closed:
        return False
    open_m, close_m = hhmm_to_minutes(today.open_time), hhmm_to_minutes(today.close_time)
    if open_m is None or close_m is None:
        return False
    minute = now.hour * 60 + now.minute
    if not (open_m <= minute < close_m):
        return False
    br_s, br_e = hhmm_to_minutes(today.break_start), hhmm_to_minutes(today.break_end)
    if br_s is not None and br_e is not None and br_s <= minute < br_e:
        return False
    return True


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'description', 'active']


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id', 'name', 'region']


class ServiceSerializer(serializers.ModelSerializer):
    business_id = serializers.ReadOnlyField()
    price = serializers.ReadOnlyField(source='price_uzs')

    class Meta:
        model = Service
        fields = ['id', 'business', 'business_id', 'name', 'description', 'price_uzs', 'price', 'duration_minutes', 'is_active']
        read_only_fields = ['id']


class StaffSerializer(serializers.ModelSerializer):
    business_id = serializers.ReadOnlyField()
    service_ids = serializers.SerializerMethodField()

    class Meta:
        model = Staff
        fields = ['id', 'business', 'business_id', 'user', 'name', 'title', 'phone', 'avatar_url', 'is_active', 'service_ids']
        read_only_fields = ['id']

    def get_service_ids(self, obj):
        # JSON array of service ids (uses prefetched services when available).
        return [s.id for s in obj.services.all()]


class BusinessHoursSerializer(serializers.ModelSerializer):
    business_id = serializers.ReadOnlyField()

    class Meta:
        model = BusinessHours
        fields = ['id', 'business', 'business_id', 'day_of_week', 'open_time', 'close_time', 'is_closed', 'break_start', 'break_end']
        read_only_fields = ['id']


class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.name')
    business_id = serializers.ReadOnlyField()
    customer_id = serializers.ReadOnlyField()
    booking_id = serializers.ReadOnlyField()

    class Meta:
        model = Review
        fields = ['id', 'business', 'business_id', 'booking_id', 'customer', 'customer_id', 'customer_name',
                  'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'created_at']


class AdminReviewSerializer(ReviewSerializer):
    business_name = serializers.ReadOnlyField(source='business.name')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')

    class Meta(ReviewSerializer.Meta):
        fields = ReviewSerializer.Meta.fields + ['business_name', 'customer_phone']


class BusinessListSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_slug = serializers.ReadOnlyField(source='category.slug')
    city_name = serializers.ReadOnlyField(source='city.name')
    avg_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    service_count = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    active_queue_count = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = [
            'id', 'name', 'slug', 'category_name', 'category_slug', 'city_name',
            'district', 'address', 'phone', 'description', 'logo_url',
            'is_verified', 'is_sponsored', 'subscription_plan_code',
            'latitude', 'longitude', 'avg_rating', 'review_count', 'service_count',
            'is_open', 'active_queue_count', 'distance_km', 'created_at'
        ]

    # Each getter uses the annotation from with_business_stats() when present and
    # falls back to a direct query for un-annotated instances (e.g. just created).
    def get_avg_rating(self, obj):
        if hasattr(obj, '_avg_rating'):
            value = obj._avg_rating
        else:
            value = obj.reviews.aggregate(a=Avg('rating'))['a']
        return round(float(value), 1) if value is not None else None

    def get_review_count(self, obj):
        return obj._review_count if hasattr(obj, '_review_count') else obj.reviews.count()

    def get_service_count(self, obj):
        return obj._service_count if hasattr(obj, '_service_count') else obj.services.filter(is_active=True).count()

    def get_is_open(self, obj):
        return compute_is_open(list(obj.hours.all()))

    def get_active_queue_count(self, obj):
        if hasattr(obj, '_active_queue_count'):
            return obj._active_queue_count
        return obj.queue_entries.filter(status__in=ACTIVE_QUEUE, queue_date=local_today()).count()

    def get_distance_km(self, obj):
        user_lat = self.context.get('user_lat')
        user_lng = self.context.get('user_lng')
        if user_lat is not None and user_lng is not None and obj.latitude is not None and obj.longitude is not None:
            radius = 6371
            d_lat = math.radians(obj.latitude - user_lat)
            d_lon = math.radians(obj.longitude - user_lng)
            a = (math.sin(d_lat / 2) ** 2 +
                 math.cos(math.radians(user_lat)) * math.cos(math.radians(obj.latitude)) *
                 math.sin(d_lon / 2) ** 2)
            return round(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)
        return None


class BusinessManageSerializer(BusinessListSerializer):
    """Business as seen by its owner/staff/admins: adds status, subscription and Telegram settings."""
    subscription_status = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()

    class Meta(BusinessListSerializer.Meta):
        fields = BusinessListSerializer.Meta.fields + [
            'status', 'owner', 'telegram_chat_id', 'telegram_channel_or_group',
            'subscription_expires_at', 'subscription_status', 'days_left', 'is_trial', 'trial_used',
        ]

    def get_subscription_status(self, obj):
        from apps.subscriptions.services import subscription_status
        return subscription_status(obj)

    def get_days_left(self, obj):
        from apps.subscriptions.services import days_left
        return days_left(obj)


class AdminBusinessSerializer(BusinessManageSerializer):
    owner_name = serializers.ReadOnlyField(source='owner.name')
    owner_email = serializers.ReadOnlyField(source='owner.email')
    owner_phone = serializers.ReadOnlyField(source='owner.phone')
    rating = serializers.SerializerMethodField()

    class Meta(BusinessManageSerializer.Meta):
        fields = BusinessManageSerializer.Meta.fields + ['owner_name', 'owner_email', 'owner_phone', 'rating']

    def get_rating(self, obj):
        return self.get_avg_rating(obj)


def staff_queryset():
    return Staff.objects.prefetch_related('services')


def business_filter_for_ref(ref):
    return Q(id=ref) | Q(slug=ref)


def business_applications_queryset(qs=None):
    from .application_models import BusinessApplication

    base = qs if qs is not None else BusinessApplication.objects.all()
    return base.select_related('category', 'city', 'reviewed_by').prefetch_related('photos', 'hours')


def business_application_payload(application):
    """Admin-panel shape for a BusinessApplication: always 7 `hours` rows (day_of_week 0..6)."""
    from django.conf import settings

    photos = [
        {'id': photo.id, 'url': f'{settings.BACKEND_URL}{photo.image.url}' if photo.image else ''}
        for photo in application.photos.all()
    ]
    hours_by_day = {h.day_of_week: h for h in application.hours.all()}
    hours = []
    for day in range(7):
        row = hours_by_day.get(day)
        hours.append({
            'day_of_week': day,
            'is_closed': row.is_closed if row else True,
            'open_time': row.open_time if row else '',
            'close_time': row.close_time if row else '',
            'break_start': row.break_start if row else '',
            'break_end': row.break_end if row else '',
        })
    return {
        'id': application.id,
        'status': application.status,
        'name': application.name,
        'category_name': application.category.name if application.category_id else None,
        'city_name': application.city.name if application.city_id else None,
        'district': application.district,
        'address': application.address,
        'phone': application.phone,
        'description': application.description,
        'photos': photos,
        'hours': hours,
        'telegram_username': application.telegram_username,
        'created_at': application.created_at.isoformat(),
        'reject_reason': application.reject_reason,
        'reviewed_by_name': application.reviewed_by.name if application.reviewed_by_id else None,
    }
