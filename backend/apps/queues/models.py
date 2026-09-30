import uuid
from django.db import models
from apps.authentication.models import User
from apps.marketplace.models import Business, Service, Staff


class QueueStatus(models.TextChoices):
    WAITING = 'WAITING', 'Kutilmoqda'
    CALLED = 'CALLED', 'Chaqirildi'
    SERVING = 'SERVING', 'Xizmat ko‘rsatilmoqda'
    COMPLETED = 'COMPLETED', 'Yakunlandi'
    SKIPPED = 'SKIPPED', 'O‘tkazib yuborildi'
    NO_SHOW = 'NO_SHOW', 'Kelgani yo‘q'


class QueueEntry(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='queue_entries')
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name='queue_entries')
    staff = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True, related_name='queue_entries')
    customer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='queue_entries')
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=32, blank=True)
    queue_number = models.CharField(max_length=16, db_index=True)
    status = models.CharField(
        max_length=32,
        choices=QueueStatus.choices,
        default=QueueStatus.WAITING,
        db_index=True
    )
    estimated_wait_minutes = models.IntegerField(default=15)
    called_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'queue_entries'
        ordering = ['created_at']

    def __str__(self):
        return f"#{self.queue_number} - {self.customer_name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"que-{uuid.uuid4().hex[:12]}"
        if not self.queue_number:
            # Generate next letter + number
            count = QueueEntry.objects.filter(business=self.business).count() + 1
            self.queue_number = f"A{count:03d}"
        super().save(*args, **kwargs)


class PendingQueueAction(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    operator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    called_entry = models.ForeignKey(QueueEntry, on_delete=models.CASCADE, related_name='pending_called')
    current_entry = models.ForeignKey(QueueEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_current')
    status = models.CharField(max_length=32, default='PENDING')  # PENDING, CONFIRMED, CANCELLED, EXPIRED
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'pending_queue_actions'

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"pqa-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class QueueAuditLog(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='queue_audits')
    action = models.CharField(max_length=64)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    entry = models.ForeignKey(QueueEntry, on_delete=models.SET_NULL, null=True, blank=True)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'queue_audit_logs'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"qal-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
