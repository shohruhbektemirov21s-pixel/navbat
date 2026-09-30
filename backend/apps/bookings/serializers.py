from rest_framework import serializers
from .models import Booking, BlockedTime


class BookingSerializer(serializers.ModelSerializer):
    business_name = serializers.ReadOnlyField(source='business.name')
    business_slug = serializers.ReadOnlyField(source='business.slug')
    business_address = serializers.ReadOnlyField(source='business.address')
    business_phone = serializers.ReadOnlyField(source='business.phone')
    service_name = serializers.ReadOnlyField(source='service.name')
    duration_minutes = serializers.ReadOnlyField(source='service.duration_minutes')
    staff_name = serializers.ReadOnlyField(source='staff.name')
    staff_avatar = serializers.ReadOnlyField(source='staff.avatar_url')

    class Meta:
        model = Booking
        fields = [
            'id', 'booking_number', 'business', 'business_name', 'business_slug',
            'business_address', 'business_phone', 'service', 'service_name',
            'duration_minutes', 'staff', 'staff_name', 'staff_avatar',
            'customer', 'customer_name', 'customer_phone', 'booking_date',
            'start_time', 'end_time', 'total_price_uzs', 'status', 'cancel_reason',
            'created_at'
        ]
        read_only_fields = ['id', 'booking_number', 'created_at']


class BlockedTimeSerializer(serializers.ModelSerializer):
    staff_name = serializers.ReadOnlyField(source='staff.name')

    class Meta:
        model = BlockedTime
        fields = ['id', 'business', 'staff', 'staff_name', 'title', 'start_datetime', 'end_datetime', 'created_at']
        read_only_fields = ['id', 'created_at']
