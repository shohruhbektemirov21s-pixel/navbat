import uuid

from django.db import models

from apps.authentication.models import User
from apps.marketplace.models import Business

TICKET_PRIORITIES = ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
TICKET_STATUSES = ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')


class SupportTicket(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    # Creator of the ticket.
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets')
    business = models.ForeignKey(Business, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    customer_name = models.CharField(max_length=255, blank=True, default='')
    customer_phone = models.CharField(max_length=32, blank=True, default='')
    subject = models.CharField(max_length=255)
    # Exposed to the frontend as `description` too.
    message = models.TextField()
    priority = models.CharField(max_length=32, default='MEDIUM')  # LOW, MEDIUM, HIGH, URGENT
    status = models.CharField(max_length=32, default='OPEN')  # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    resolution_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'support_tickets'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"tkt-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
