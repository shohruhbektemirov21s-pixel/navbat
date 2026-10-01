import json

from rest_framework import serializers

from .models import AdPromotion, SubscriptionPlan, SubscriptionTransaction


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    features = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'code', 'price_uzs', 'max_staff', 'max_monthly_bookings', 'features_json', 'features']

    def get_features(self, obj):
        try:
            value = json.loads(obj.features_json or '[]')
        except (TypeError, ValueError):
            return []
        return value if isinstance(value, list) else []


class SubscriptionTransactionSerializer(serializers.ModelSerializer):
    business_id = serializers.ReadOnlyField()
    business_name = serializers.ReadOnlyField(source='business.name')
    owner_name = serializers.ReadOnlyField(source='business.owner.name')
    owner_phone = serializers.ReadOnlyField(source='business.owner.phone')
    owner_email = serializers.ReadOnlyField(source='business.owner.email')

    class Meta:
        model = SubscriptionTransaction
        fields = ['id', 'business', 'business_id', 'business_name', 'owner_name', 'owner_phone', 'owner_email',
                  'kind', 'plan_code', 'amount_uzs', 'months', 'duration_days', 'payment_method', 'status',
                  'confirmed_at', 'created_at']
        read_only_fields = fields


class AdPromotionSerializer(serializers.ModelSerializer):
    business_id = serializers.ReadOnlyField()
    business_name = serializers.ReadOnlyField(source='business.name')

    class Meta:
        model = AdPromotion
        fields = ['id', 'business', 'business_id', 'business_name', 'title', 'banner_url', 'link_url', 'is_active',
                  'status', 'start_date', 'end_date', 'total_amount', 'payment_method', 'impressions', 'clicks',
                  'created_at']
        read_only_fields = fields
