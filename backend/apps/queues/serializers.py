from collections import defaultdict

from rest_framework import serializers

from .models import QueueAuditLog, QueueEntry, QueueStatus

ENTRY_RELATED = ('business', 'service', 'staff', 'customer')


def build_ahead_map(entries):
    """{entry_id: people ahead} for WAITING entries, with one query per (business, day) group."""
    groups = defaultdict(list)
    for entry in entries:
        if entry is not None and entry.status == QueueStatus.WAITING:
            groups[(entry.business_id, entry.queue_date)].append(entry.id)
    result = {}
    for (business_id, day), _ids in groups.items():
        waiting_ids = QueueEntry.objects.filter(
            business_id=business_id, queue_date=day, status=QueueStatus.WAITING
        ).order_by('created_at', 'id').values_list('id', flat=True)
        for index, entry_id in enumerate(waiting_ids):
            result[entry_id] = index
    return result


class QueueEntrySerializer(serializers.ModelSerializer):
    """Full ticket for the customer themself and for the business operator (includes phone)."""
    business_id = serializers.ReadOnlyField()
    service_id = serializers.ReadOnlyField()
    staff_id = serializers.ReadOnlyField()
    customer_id = serializers.ReadOnlyField()
    business_name = serializers.ReadOnlyField(source='business.name')
    business_slug = serializers.ReadOnlyField(source='business.slug')
    business_address = serializers.ReadOnlyField(source='business.address')
    service_name = serializers.ReadOnlyField(source='service.name')
    staff_name = serializers.ReadOnlyField(source='staff.name')
    joined_at = serializers.ReadOnlyField(source='created_at')
    ahead_count = serializers.SerializerMethodField()
    peopleAhead = serializers.SerializerMethodField()
    estimatedWaitMinutes = serializers.SerializerMethodField()

    class Meta:
        model = QueueEntry
        fields = [
            'id', 'business', 'business_id', 'business_name', 'business_slug', 'business_address',
            'service', 'service_id', 'service_name', 'staff', 'staff_id', 'staff_name',
            'customer', 'customer_id', 'customer_name', 'customer_phone', 'telegram_chat_id',
            'queue_date', 'queue_number', 'status', 'estimated_wait_minutes', 'called_at', 'served_at',
            'created_at', 'joined_at', 'ahead_count', 'peopleAhead', 'estimatedWaitMinutes',
        ]
        read_only_fields = fields

    def get_ahead_count(self, obj):
        if obj.status != QueueStatus.WAITING:
            return 0
        ahead_map = self.context.get('ahead_map')
        if ahead_map is not None and obj.id in ahead_map:
            return ahead_map[obj.id]
        from .services import ahead_count
        return ahead_count(obj)

    def get_peopleAhead(self, obj):  # noqa: N802 - frontend field name
        return self.get_ahead_count(obj)

    def get_estimatedWaitMinutes(self, obj):  # noqa: N802 - frontend field name
        if obj.status != QueueStatus.WAITING:
            return 0
        per_customer = obj.service.duration_minutes if obj.service and obj.service.duration_minutes else 15
        return (self.get_ahead_count(obj) + 1) * per_customer


def serialize_entries(entries, **context):
    entries = list(entries)
    return QueueEntrySerializer(entries, many=True, context={'ahead_map': build_ahead_map(entries), **context}).data


def serialize_entry(entry):
    if entry is None:
        return None
    return QueueEntrySerializer(entry, context={'ahead_map': build_ahead_map([entry])}).data


def mask_name(name):
    """'Otabek Rustamov' -> 'Otabek R.' (public boards never show full names or phones)."""
    parts = (name or '').split()
    if not parts:
        return 'Mijoz'
    if len(parts) == 1:
        return parts[0]
    return f'{parts[0]} {parts[1][0].upper()}.'


class PublicQueueSerializer(serializers.ModelSerializer):
    """TV board / public view: masked name, no phone, no customer or Telegram ids."""
    customer_name = serializers.SerializerMethodField()
    service_name = serializers.ReadOnlyField(source='service.name')
    joined_at = serializers.ReadOnlyField(source='created_at')

    class Meta:
        model = QueueEntry
        fields = ['id', 'queue_number', 'customer_name', 'service_name', 'status', 'called_at', 'joined_at']
        read_only_fields = fields

    def get_customer_name(self, obj):
        return mask_name(obj.customer_name)


class QueueAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.ReadOnlyField(source='actor.name')
    queue_number = serializers.ReadOnlyField(source='entry.queue_number')
    customer_name = serializers.ReadOnlyField(source='entry.customer_name')
    timestamp = serializers.ReadOnlyField(source='created_at')

    class Meta:
        model = QueueAuditLog
        fields = ['id', 'business', 'action', 'actor', 'actor_name', 'entry', 'queue_number', 'customer_name',
                  'details', 'created_at', 'timestamp']
        read_only_fields = fields
