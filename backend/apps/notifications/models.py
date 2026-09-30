import uuid
from django.db import models
from apps.authentication.models import User


class Notification(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=32, default='INFO')  # INFO, SUCCESS, WARNING, ERROR
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"notif-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class TelegramLog(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    chat_id = models.CharField(max_length=64)
    message = models.TextField()
    status = models.CharField(max_length=32, default='SENT')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'telegram_logs'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"tgl-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
