from rest_framework import serializers
from .models import CRMLead, PartnerCommission, PartnerReport


class CRMLeadSerializer(serializers.ModelSerializer):
    assigned_name = serializers.ReadOnlyField(source='assigned_to.name')

    class Meta:
        model = CRMLead
        fields = ['id', 'business_name', 'contact_person', 'phone', 'city', 'category', 'status', 'notes', 'assigned_to', 'assigned_name', 'created_at']
        read_only_fields = ['id', 'created_at']


class PartnerCommissionSerializer(serializers.ModelSerializer):
    business_name = serializers.ReadOnlyField(source='business.name')
    partner_name = serializers.ReadOnlyField(source='partner.name')

    class Meta:
        model = PartnerCommission
        fields = ['id', 'partner', 'partner_name', 'business', 'business_name', 'amount_uzs', 'period_month', 'status', 'payout_notes', 'created_at']
        read_only_fields = ['id', 'created_at']


class PartnerReportSerializer(serializers.ModelSerializer):
    partner_name = serializers.ReadOnlyField(source='partner.name')

    class Meta:
        model = PartnerReport
        fields = ['id', 'partner', 'partner_name', 'report_type', 'period_label', 'content', 'founder_feedback', 'created_at']
        read_only_fields = ['id', 'created_at']
