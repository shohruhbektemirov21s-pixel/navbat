from rest_framework import serializers
from .models import QueueEntry, PendingQueueAction, QueueAuditLog


class QueueEntrySerializer(serializers.ModelSerializer):
    business_name = serializers.ReadOnlyField(source='business.name')
    business_slug = serializers.ReadOnlyField(source='business.slug')
    business_address = serializers.ReadOnlyField(source='business.address')
    service_name = serializers.ReadOnlyField(source='service.name')
    staff_name = serializers.ReadOnlyField(source='staff.name')
    ahead_count = serializers.SerializerMethodField()

    class Meta:
        model = QueueEntry
        fields = [
            'id', 'business', 'business_name', 'business_slug', 'business_address',
            'service', 'service_name', 'staff', 'staff_name',
            'customer', 'customer_name', 'customer_phone', 'queue_number',
            'status', 'estimated_wait_minutes', 'called_at', 'served_at',
            'created_at', 'ahead_count'
        ]
        read_only_fields = ['id', 'queue_number', 'created_at']

    def get_ahead_count(self, obj):
        if obj.status == 'WAITING':
            return QueueEntry.objects.filter(
                business=obj.business,
                status='WAITING',
                created_at__lt=obj.created_at
            ).count()
        return 0


class QueueAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.ReadOnlyField(source='actor.name')

    class Meta:
        model = QueueAuditLog
        fields = ['id', 'business', 'action', 'actor', 'actor_name', 'entry', 'details', 'created_at']
