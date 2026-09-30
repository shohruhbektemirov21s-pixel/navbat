import uuid
from django.db import models
from apps.authentication.models import User


class AppSetting(models.Model):
    key = models.CharField(max_length=128, primary_key=True)
    value = models.TextField(blank=True, default='')
    description = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'app_settings'


class AuditLog(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    user_email = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=128, db_index=True)
    entity = models.CharField(max_length=64, db_index=True)
    entity_id = models.CharField(max_length=64, blank=True, null=True)
    details = models.TextField(blank=True, default='')
    ip_address = models.CharField(max_length=45, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"aud-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


def log_audit(user, action, entity, entity_id='', details='', ip=''):
    try:
        user_obj = user if (user and user.is_authenticated) else None
        user_email = user.email if (user and user.is_authenticated) else 'anonymous'
        AuditLog.objects.create(
            user=user_obj,
            user_email=user_email,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id else '',
            details=str(details),
            ip_address=ip or ''
        )
    except Exception as e:
        print(f"Error logging audit: {e}")
