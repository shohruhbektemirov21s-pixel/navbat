import logging
import uuid

from django.db import models

from apps.authentication.models import User

logger = logging.getLogger('apps.audit')


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
    user_name = models.CharField(max_length=255, blank=True, default='')
    user_role = models.CharField(max_length=32, blank=True, default='')
    action = models.CharField(max_length=128, db_index=True)
    # `entity` is exposed to the frontend as `target_type`, `entity_id` as `target_id`.
    entity = models.CharField(max_length=64, db_index=True)
    entity_id = models.CharField(max_length=64, blank=True, null=True)
    target_name = models.CharField(max_length=255, blank=True, default='')
    details = models.TextField(blank=True, default='')
    old_value = models.CharField(max_length=255, blank=True, default='')
    new_value = models.CharField(max_length=255, blank=True, default='')
    ip_address = models.CharField(max_length=45, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"aud-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)

    def as_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_email': self.user_email,
            'user_name': self.user_name,
            'user_role': self.user_role,
            'action': self.action,
            'entity': self.entity,
            'entity_id': self.entity_id,
            'target_type': self.entity,
            'target_id': self.entity_id,
            'target_name': self.target_name,
            'details': self.details,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


def log_audit(user, action, entity, entity_id='', details='', ip='', *, target_name='', old_value='', new_value=''):
    """Persist an audit record. Never raises: auditing must not break the business action."""
    try:
        authenticated = bool(user and getattr(user, 'is_authenticated', False))
        AuditLog.objects.create(
            user=user if authenticated else None,
            user_email=user.email if authenticated else 'anonymous',
            user_name=(user.name or '') if authenticated else '',
            user_role=(user.role or '') if authenticated else '',
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id else '',
            target_name=str(target_name)[:255],
            details=str(details),
            old_value=str(old_value or '')[:255],
            new_value=str(new_value or '')[:255],
            ip_address=ip or '',
        )
    except Exception:  # pragma: no cover - defensive
        logger.exception('audit_log_failed action=%s entity=%s entity_id=%s', action, entity, entity_id)
