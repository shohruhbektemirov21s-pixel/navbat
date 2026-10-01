from rest_framework import serializers

from .models import CRMLead, PartnerCommission, PartnerReport


class CRMLeadSerializer(serializers.ModelSerializer):
    owner_name = serializers.ReadOnlyField(source='contact_person')
    business_type = serializers.ReadOnlyField(source='category')
    assigned_partner_id = serializers.ReadOnlyField(source='assigned_to_id')
    assigned_partner_name = serializers.ReadOnlyField(source='assigned_to.name')
    assigned_name = serializers.ReadOnlyField(source='assigned_to.name')
    converted_business_id = serializers.ReadOnlyField()

    class Meta:
        model = CRMLead
        fields = ['id', 'business_name', 'owner_name', 'contact_person', 'phone', 'telegram_username', 'address',
                  'city', 'business_type', 'category', 'status', 'deal_value_uzs', 'last_contact_date',
                  'next_contact_date', 'notes', 'assigned_to', 'assigned_partner_id', 'assigned_partner_name',
                  'assigned_name', 'converted_business_id', 'created_at', 'updated_at']
        read_only_fields = fields


class PartnerCommissionSerializer(serializers.ModelSerializer):
    business_id = serializers.ReadOnlyField()
    business_name = serializers.ReadOnlyField(source='business.name')
    partner_id = serializers.ReadOnlyField()
    partner_name = serializers.ReadOnlyField(source='partner.name')
    transaction_id = serializers.ReadOnlyField()
    partner_share_uzs = serializers.ReadOnlyField(source='amount_uzs')
    payment_status = serializers.ReadOnlyField(source='status')

    class Meta:
        model = PartnerCommission
        fields = ['id', 'transaction_id', 'partner', 'partner_id', 'partner_name', 'business', 'business_id',
                  'business_name', 'plan_code', 'total_amount_uzs', 'partner_rate', 'partner_share_uzs', 'amount_uzs',
                  'navbatbor_share_uzs', 'period_month', 'payment_status', 'status', 'paid_at', 'payout_notes',
                  'created_at']
        read_only_fields = fields


class PartnerReportSerializer(serializers.ModelSerializer):
    partner_id = serializers.ReadOnlyField()
    partner_name = serializers.ReadOnlyField(source='partner.name')
    completed_work = serializers.ReadOnlyField(source='content')

    class Meta:
        model = PartnerReport
        fields = ['id', 'partner', 'partner_id', 'partner_name', 'report_type', 'period_label', 'period_start',
                  'period_end', 'new_businesses_count', 'total_businesses_count', 'total_revenue_uzs',
                  'partner_commission_uzs', 'new_customers_count', 'completed_work', 'content', 'issues_summary',
                  'next_week_plan', 'status', 'founder_feedback', 'telegram_sent', 'reviewed_at', 'created_at']
        read_only_fields = fields
