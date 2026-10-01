"""Telegram-bot driven business onboarding: an owner applies entirely through chat, a
FOUNDER/ADMIN approves or rejects it (from the bot or the web admin panel), and only then
does a real `Business` get created. Kept in a separate module (imported at the bottom of
`models.py`) purely to keep `models.py` from becoming unwieldy; it is the same Django app.
"""
import uuid

from django.db import models

from apps.authentication.models import User

from .models import Business, Category, City


class BusinessApplicationStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Qoralama'
    PENDING = 'PENDING', 'Kutilmoqda'
    APPROVED = 'APPROVED', 'Tasdiqlangan'
    REJECTED = 'REJECTED', 'Rad etilgan'


class BusinessApplicationStep(models.TextChoices):
    ASK_NAME = 'ASK_NAME', 'Nomi'
    ASK_CATEGORY = 'ASK_CATEGORY', 'Kategoriya'
    ASK_CITY = 'ASK_CITY', 'Shahar'
    ASK_DISTRICT = 'ASK_DISTRICT', 'Tuman'
    ASK_ADDRESS = 'ASK_ADDRESS', 'Manzil'
    ASK_PHONE = 'ASK_PHONE', 'Telefon'
    ASK_HOURS = 'ASK_HOURS', 'Ish vaqti'
    ASK_DESCRIPTION = 'ASK_DESCRIPTION', 'Tavsif'
    ASK_PHOTOS = 'ASK_PHOTOS', 'Rasmlar'
    CONFIRM = 'CONFIRM', 'Tasdiqlash'
    DONE = 'DONE', 'Tugallandi'


class BusinessApplication(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)

    telegram_chat_id = models.CharField(max_length=64, db_index=True)
    telegram_user_id = models.CharField(max_length=64, blank=True)
    telegram_username = models.CharField(max_length=128, blank=True)
    applicant = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='business_applications'
    )

    name = models.CharField(max_length=255, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True)
    district = models.CharField(max_length=128, blank=True)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    description = models.TextField(blank=True)

    status = models.CharField(
        max_length=16, choices=BusinessApplicationStatus.choices, default=BusinessApplicationStatus.DRAFT,
        db_index=True,
    )
    step = models.CharField(
        max_length=24, choices=BusinessApplicationStep.choices, default=BusinessApplicationStep.ASK_NAME,
    )
    # Short-lived marker: the Telegram chat id of the admin who just clicked "Rad etish" and
    # whose NEXT text message should be interpreted as the rejection reason for this application.
    # DB-backed (not an in-memory dict) so it survives a bot restart mid-conversation.
    awaiting_reject_from = models.CharField(max_length=64, blank=True, default='')

    reject_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_business_applications'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    resulting_business = models.ForeignKey(
        Business, on_delete=models.SET_NULL, null=True, blank=True, related_name='source_application'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'business_applications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name or 'Nomsiz ariza'} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"bizapp-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class BusinessApplicationPhoto(models.Model):
    application = models.ForeignKey(BusinessApplication, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='business_applications/%Y/%m/')
    telegram_file_id = models.CharField(max_length=255, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'business_application_photos'
        ordering = ['order', 'created_at']


class BusinessApplicationHours(models.Model):
    """Mirrors `BusinessHours` field-for-field so copying to the real model on approval is a plain loop."""
    application = models.ForeignKey(BusinessApplication, on_delete=models.CASCADE, related_name='hours')
    day_of_week = models.IntegerField(help_text='0=Yakshanba (Sunday) ... 6=Shanba (Saturday)')
    open_time = models.CharField(max_length=10, default='09:00')
    close_time = models.CharField(max_length=10, default='18:00')
    is_closed = models.BooleanField(default=False)
    break_start = models.CharField(max_length=10, blank=True, default='')
    break_end = models.CharField(max_length=10, blank=True, default='')

    class Meta:
        db_table = 'business_application_hours'
        unique_together = ('application', 'day_of_week')
        ordering = ['day_of_week']
