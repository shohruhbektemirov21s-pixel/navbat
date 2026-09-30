import uuid
from django.db import models
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


class SubscriptionTransaction(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='subscription_txs')
    plan_code = models.CharField(max_length=32)
    amount_uzs = models.IntegerField(default=0)
    months = models.IntegerField(default=1)
    status = models.CharField(max_length=32, default='PENDING')  # PENDING, CONFIRMED, CANCELLED
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
    title = models.CharField(max_length=255)
    banner_url = models.URLField(max_length=500, blank=True)
    link_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ad_promotions'

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"ad-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
