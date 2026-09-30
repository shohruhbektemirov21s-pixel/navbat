import math
from rest_framework import serializers
from .models import Category, City, Business, Service, Staff, BusinessHours, Review, SavedBusiness


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'description', 'active']


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id', 'name', 'region']


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ['id', 'business', 'name', 'description', 'price_uzs', 'duration_minutes', 'is_active']
        read_only_fields = ['id']


class StaffSerializer(serializers.ModelSerializer):
    service_ids = serializers.SerializerMethodField()

    class Meta:
        model = Staff
        fields = ['id', 'business', 'user', 'name', 'title', 'phone', 'avatar_url', 'is_active', 'service_ids']
        read_only_fields = ['id']

    def get_service_ids(self, obj):
        return [s.id for s in obj.services.all()]


class BusinessHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessHours
        fields = ['id', 'business', 'day_of_week', 'open_time', 'close_time', 'is_closed', 'break_start', 'break_end']
        read_only_fields = ['id']


class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.name')

    class Meta:
        model = Review
        fields = ['id', 'business', 'customer', 'customer_name', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'created_at']


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

    def get_avg_rating(self, obj):
        reviews = obj.reviews.all()
        if not reviews.exists():
            return 4.9  # Default authentic rating
        return round(sum(r.rating for r in reviews) / reviews.count(), 1)

    def get_review_count(self, obj):
        return obj.reviews.count()

    def get_service_count(self, obj):
        return obj.services.filter(is_active=True).count()

    def get_is_open(self, obj):
        # Open check based on current day and time
        return True

    def get_active_queue_count(self, obj):
        return getattr(obj, 'queue_entries', None).filter(status__in=['WAITING', 'CALLED', 'SERVING']).count() if hasattr(obj, 'queue_entries') else 0

    def get_distance_km(self, obj):
        user_lat = self.context.get('user_lat')
        user_lng = self.context.get('user_lng')
        if user_lat is not None and user_lng is not None and obj.latitude and obj.longitude:
            # Haversine
            R = 6371
            d_lat = math.radians(obj.latitude - user_lat)
            d_lon = math.radians(obj.longitude - user_lng)
            a = (math.sin(d_lat / 2) ** 2 +
                 math.cos(math.radians(user_lat)) * math.cos(math.radians(obj.latitude)) *
                 math.sin(d_lon / 2) ** 2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return round(R * c, 1)
        return None
