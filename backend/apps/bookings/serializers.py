from rest_framework import serializers

from .models import BlockedTime, Booking


class BookingSerializer(serializers.ModelSerializer):
    business_id = serializers.ReadOnlyField()
    service_id = serializers.ReadOnlyField()
    staff_id = serializers.ReadOnlyField()
    customer_id = serializers.ReadOnlyField()
    business_name = serializers.ReadOnlyField(source='business.name')
    business_slug = serializers.ReadOnlyField(source='business.slug')
    business_address = serializers.ReadOnlyField(source='business.address')
    business_phone = serializers.ReadOnlyField(source='business.phone')
    service_name = serializers.ReadOnlyField(source='service.name')
    duration_minutes = serializers.ReadOnlyField(source='service.duration_minutes')
    staff_name = serializers.ReadOnlyField(source='staff.name')
    staff_avatar = serializers.ReadOnlyField(source='staff.avatar_url')
    review_id = serializers.SerializerMethodField()
    review_rating = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'booking_number', 'business', 'business_id', 'business_name', 'business_slug',
            'business_address', 'business_phone', 'service', 'service_id', 'service_name',
            'duration_minutes', 'staff', 'staff_id', 'staff_name', 'staff_avatar',
            'customer', 'customer_id', 'customer_name', 'customer_phone', 'booking_date',
            'start_time', 'end_time', 'total_price_uzs', 'status', 'cancel_reason',
            'reminder_sent', 'review_id', 'review_rating', 'created_at'
        ]
        read_only_fields = fields

    @staticmethod
    def _review(obj):
        try:
            return obj.review
        except Exception:  # RelatedObjectDoesNotExist
            return None

    def get_review_id(self, obj):
        review = self._review(obj)
        return review.id if review else None

    def get_review_rating(self, obj):
        review = self._review(obj)
        return review.rating if review else None


BOOKING_RELATED = ('business', 'service', 'staff', 'customer', 'review')


class BlockedTimeSerializer(serializers.ModelSerializer):
    staff_name = serializers.ReadOnlyField(source='staff.name')
    business_id = serializers.ReadOnlyField()
    staff_id = serializers.ReadOnlyField()

    class Meta:
        model = BlockedTime
        fields = ['id', 'business', 'business_id', 'staff', 'staff_id', 'staff_name', 'title', 'start_datetime',
                  'end_datetime', 'created_at']
        read_only_fields = fields
