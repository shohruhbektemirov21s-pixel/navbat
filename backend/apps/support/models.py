import uuid
from django.db import models
from apps.authentication.models import User


class SupportTicket(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets')
    subject = models.CharField(max_length=255)
    message = models.TextField()
    priority = models.CharField(max_length=32, default='MEDIUM')  # LOW, MEDIUM, HIGH, URGENT
    status = models.CharField(max_length=32, default='OPEN')  # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'support_tickets'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"tkt-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
