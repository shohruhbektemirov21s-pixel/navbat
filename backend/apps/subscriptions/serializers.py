import json
from rest_framework import serializers
from .models import SubscriptionPlan, SubscriptionTransaction, AdPromotion


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    features = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'code', 'price_uzs', 'max_staff', 'max_monthly_bookings', 'features_json', 'features']

    def get_features(self, obj):
        try:
            return json.loads(obj.features_json)
        except:
            return []


class SubscriptionTransactionSerializer(serializers.ModelSerializer):
    business_name = serializers.ReadOnlyField(source='business.name')

    class Meta:
        model = SubscriptionTransaction
        fields = ['id', 'business', 'business_name', 'plan_code', 'amount_uzs', 'months', 'status', 'created_at']


class AdPromotionSerializer(serializers.ModelSerializer):
    business_name = serializers.ReadOnlyField(source='business.name')

    class Meta:
        model = AdPromotion
        fields = ['id', 'business', 'business_name', 'title', 'banner_url', 'link_url', 'is_active', 'created_at']
