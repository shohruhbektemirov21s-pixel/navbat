import uuid

from django.db import models

from apps.authentication.models import User
from apps.marketplace.models import Business


class SubscriptionPlan(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    name = models.CharField(max_length=64)
    code = models.CharField(max_length=32, unique=True)
    price_uzs = models.IntegerField(default=0)
    max_staff = models.IntegerField(default=1)
    max_monthly_bookings = models.IntegerField(default=50)
    features_json = models.TextField(default='[]')

    class Meta:
        db_table = 'subscription_plans'

    def __str__(self):
        return f"{self.name} ({self.price_uzs:,} so'm)"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"plan-{self.code.lower()}"
        super().save(*args, **kwargs)


class TransactionStatus(models.TextChoices):
    PENDING = 'PENDING', 'Kutilmoqda'
    CONFIRMED = 'CONFIRMED', 'Tasdiqlandi'
    CANCELLED = 'CANCELLED', 'Bekor qilindi'


class TransactionKind(models.TextChoices):
    SUBSCRIPTION = 'SUBSCRIPTION', 'Obuna'
    PROMOTION = 'PROMOTION', 'Reklama'


class SubscriptionTransaction(models.Model):
    """A payment request. Nothing is granted until an admin confirms it (AdminConfirmPaymentView)."""
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='subscription_txs')
    kind = models.CharField(max_length=16, choices=TransactionKind.choices, default=TransactionKind.SUBSCRIPTION)
    plan_code = models.CharField(max_length=32)
    amount_uzs = models.IntegerField(default=0)
    months = models.IntegerField(default=1)
    duration_days = models.IntegerField(default=30)
    payment_method = models.CharField(max_length=32, default='TELEGRAM')
    status = models.CharField(max_length=32, default=TransactionStatus.PENDING, choices=TransactionStatus.choices)
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    confirmed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'subscription_transactions'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"tx-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class AdPromotion(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='promotions')
    transaction = models.ForeignKey(
        SubscriptionTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='promotions'
    )
    title = models.CharField(max_length=255)
    banner_url = models.URLField(max_length=500, blank=True)
    link_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=16, default='ACTIVE')  # ACTIVE, EXPIRED, CANCELLED
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    total_amount = models.IntegerField(default=0)
    payment_method = models.CharField(max_length=32, blank=True, default='')
    impressions = models.IntegerField(default=0)
    clicks = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ad_promotions'

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"ad-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
