import uuid

from django.db import models

from apps.authentication.models import User
from apps.marketplace.models import Business


class LeadStage(models.TextChoices):
    LEAD = 'LEAD', 'Yangi lead'
    CONTACTED = 'CONTACTED', 'Aloqaga chiqildi'
    DEMO = 'DEMO', 'Demo'
    TRIAL = 'TRIAL', 'Sinov'
    PAID = 'PAID', 'To‘lov qilgan'
    ACTIVE = 'ACTIVE', 'Faol mijoz'
    CHURNED = 'CHURNED', 'Ketgan'


class CRMLead(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business_name = models.CharField(max_length=255)
    # Exposed to the frontend as `owner_name`.
    contact_person = models.CharField(max_length=255)
    phone = models.CharField(max_length=32)
    telegram_username = models.CharField(max_length=128, blank=True, default='')
    address = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=128, default='Qarshi')
    # Exposed to the frontend as `business_type`.
    category = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=32, default=LeadStage.LEAD, choices=LeadStage.choices)
    deal_value_uzs = models.IntegerField(default=0)
    last_contact_date = models.DateField(null=True, blank=True)
    next_contact_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    converted_business = models.ForeignKey(
        Business, on_delete=models.SET_NULL, null=True, blank=True, related_name='source_leads'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_leads'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"lead-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


PARTNER_COMMISSION_RATE = 0.30


class PartnerCommission(models.Model):
    """Operating partner share of a confirmed payment (30% partner / 70% NavbatBor)."""
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    partner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='commissions')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='partner_commissions')
    transaction = models.ForeignKey(
        'subscriptions.SubscriptionTransaction', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='commissions'
    )
    plan_code = models.CharField(max_length=32, blank=True, default='')
    total_amount_uzs = models.IntegerField(default=0)
    partner_rate = models.FloatField(default=PARTNER_COMMISSION_RATE)
    # Partner share (exposed as `partner_share_uzs`).
    amount_uzs = models.IntegerField(default=0)
    navbatbor_share_uzs = models.IntegerField(default=0)
    period_month = models.CharField(max_length=16)
    status = models.CharField(max_length=32, default='PENDING')  # PENDING, PAID, CANCELLED
    paid_at = models.DateTimeField(null=True, blank=True)
    payout_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'partner_commissions'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"com-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class PartnerReport(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    partner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports')
    report_type = models.CharField(max_length=32, default='WEEKLY')  # WEEKLY, MONTHLY
    period_label = models.CharField(max_length=64)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    new_businesses_count = models.IntegerField(default=0)
    total_businesses_count = models.IntegerField(default=0)
    total_revenue_uzs = models.IntegerField(default=0)
    partner_commission_uzs = models.IntegerField(default=0)
    new_customers_count = models.IntegerField(default=0)
    # Exposed as `completed_work` (legacy name kept for existing rows).
    content = models.TextField()
    issues_summary = models.TextField(blank=True, default='')
    next_week_plan = models.TextField(blank=True, default='')
    status = models.CharField(max_length=16, default='SUBMITTED')  # DRAFT, SUBMITTED, REVIEWED
    telegram_sent = models.BooleanField(default=False)
    founder_feedback = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'partner_reports'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"rep-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
