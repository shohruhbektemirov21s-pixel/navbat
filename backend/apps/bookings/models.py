import uuid
from django.db import models
from apps.authentication.models import User
from apps.marketplace.models import Business, Service, Staff


class BookingStatus(models.TextChoices):
    PENDING = 'PENDING', 'Kutilmoqda'
    CONFIRMED = 'CONFIRMED', 'Tasdiqlangan'
    IN_PROGRESS = 'IN_PROGRESS', 'Jarayonda'
    COMPLETED = 'COMPLETED', 'Bajarildi'
    CANCELLED = 'CANCELLED', 'Bekor qilindi'
    NO_SHOW = 'NO_SHOW', 'Kelgani yo‘q'


class Booking(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    booking_number = models.CharField(max_length=32, unique=True, db_index=True)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='bookings')
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='bookings')
    staff = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='customer_bookings')
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=32)
    booking_date = models.DateField(db_index=True)
    start_time = models.CharField(max_length=10)
    end_time = models.CharField(max_length=10)
    total_price_uzs = models.IntegerField(default=0)
    status = models.CharField(
        max_length=32,
        choices=BookingStatus.choices,
        default=BookingStatus.CONFIRMED,
        db_index=True
    )
    cancel_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bookings'
        ordering = ['-booking_date', '-start_time']

    def __str__(self):
        return f"#{self.booking_number} - {self.customer_name} ({self.booking_date} {self.start_time})"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"bkg-{uuid.uuid4().hex[:12]}"
        if not self.booking_number:
            self.booking_number = f"NB-{uuid.uuid4().int % 900000 + 100000}"
        super().save(*args, **kwargs)


class BlockedTime(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='blocked_times')
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, null=True, blank=True, related_name='blocked_times')
    title = models.CharField(max_length=255, default='Band vaqt')
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'blocked_times'
        ordering = ['-start_datetime']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"blk-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
