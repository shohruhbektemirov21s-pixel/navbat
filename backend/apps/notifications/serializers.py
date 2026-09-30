from rest_framework import serializers
from .models import Notification, TelegramLog


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'user', 'title', 'message', 'type', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']


class TelegramLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelegramLog
        fields = ['id', 'chat_id', 'message', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']
