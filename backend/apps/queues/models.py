import uuid

from django.db import models
from django.utils import timezone

from apps.authentication.models import User
from apps.marketplace.models import Business, Service, Staff


class QueueStatus(models.TextChoices):
    WAITING = 'WAITING', 'Kutilmoqda'
    CALLED = 'CALLED', 'Chaqirildi'
    SERVING = 'SERVING', 'Xizmat ko‘rsatilmoqda'
    COMPLETED = 'COMPLETED', 'Yakunlandi'
    SKIPPED = 'SKIPPED', 'O‘tkazib yuborildi'
    NO_SHOW = 'NO_SHOW', 'Kelgani yo‘q'


ACTIVE_QUEUE_STATUSES = (QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.SERVING)


class QueueEntry(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='queue_entries')
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name='queue_entries')
    staff = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True, related_name='queue_entries')
    customer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='queue_entries')
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=32, blank=True)
    telegram_chat_id = models.CharField(max_length=64, blank=True, default='')
    # Local (Asia/Tashkent) day the ticket belongs to; numbers restart every day per business.
    queue_date = models.DateField(default=timezone.localdate, db_index=True)
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
        constraints = [
            models.UniqueConstraint(fields=['business', 'queue_date', 'queue_number'], name='uniq_queue_number_per_business_day'),
        ]

    def __str__(self):
        return f"#{self.queue_number} - {self.customer_name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"que-{uuid.uuid4().hex[:12]}"
        if not self.queue_number:
            # Import lazily to avoid a circular import; numbering is atomic and per business per day.
            from .services import allocate_queue_number
            self.queue_number = allocate_queue_number(self.business, self.queue_date)
        super().save(*args, **kwargs)


class QueueDailyCounter(models.Model):
    """Row-locked counter used to hand out sequential ticket numbers per business per day."""
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='queue_counters')
    date = models.DateField()
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'queue_daily_counters'
        constraints = [
            models.UniqueConstraint(fields=['business', 'date'], name='uniq_queue_counter_per_business_day'),
        ]


class PendingActionStatus(models.TextChoices):
    PENDING = 'PENDING', 'Kutilmoqda'
    CONFIRMED = 'CONFIRMED', 'Tasdiqlandi'
    CANCELLED = 'CANCELLED', 'Bekor qilindi'
    EXPIRED = 'EXPIRED', 'Muddati o‘tdi'


class PendingQueueAction(models.Model):
    """'Call next customer' request awaiting confirmation (web fallback button or Telegram inline button)."""
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    operator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    called_entry = models.ForeignKey(QueueEntry, on_delete=models.CASCADE, related_name='pending_called')
    current_entry = models.ForeignKey(QueueEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_current')
    status = models.CharField(max_length=32, default=PendingActionStatus.PENDING, choices=PendingActionStatus.choices)
    source = models.CharField(max_length=16, default='WEB')  # WEB, TELEGRAM
    telegram_chat_id = models.CharField(max_length=64, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'pending_queue_actions'

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"pqa-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return self.status == PendingActionStatus.PENDING and timezone.now() >= self.expires_at


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
