from rest_framework import serializers
from .models import SupportTicket


class SupportTicketSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.name')
    user_email = serializers.ReadOnlyField(source='user.email')

    class Meta:
        model = SupportTicket
        fields = ['id', 'user', 'user_name', 'user_email', 'subject', 'message', 'priority', 'status', 'resolution_notes', 'created_at']
        read_only_fields = ['id', 'created_at']
