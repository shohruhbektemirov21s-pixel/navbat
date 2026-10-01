from rest_framework import serializers

from .models import SupportTicket


class SupportTicketSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.name')
    user_email = serializers.ReadOnlyField(source='user.email')
    business_id = serializers.ReadOnlyField()
    business_name = serializers.SerializerMethodField()
    customer_id = serializers.ReadOnlyField(source='user_id')
    description = serializers.ReadOnlyField(source='message')
    assigned_to_id = serializers.ReadOnlyField()
    assigned_to_name = serializers.ReadOnlyField(source='assigned_to.name')

    class Meta:
        model = SupportTicket
        fields = ['id', 'user', 'user_name', 'user_email', 'business_id', 'business_name', 'customer_id',
                  'customer_name', 'customer_phone', 'subject', 'message', 'description', 'priority', 'status',
                  'assigned_to_id', 'assigned_to_name', 'resolution_notes', 'resolved_at', 'created_at']
        read_only_fields = fields

    def get_business_name(self, obj):
        return obj.business.name if obj.business_id else None
