import uuid
from django.db import models
from apps.authentication.models import User
from apps.marketplace.models import Business


class CRMLead(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business_name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255)
    phone = models.CharField(max_length=32)
    city = models.CharField(max_length=128, default='Qarshi')
    category = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=32, default='NEW')  # NEW, CONTACTED, MEETING, DEMO, AGREEMENT, WON, LOST
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_leads'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"lead-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class PartnerCommission(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    partner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='commissions')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='partner_commissions')
    amount_uzs = models.IntegerField(default=0)
    period_month = models.CharField(max_length=16)
    status = models.CharField(max_length=32, default='PENDING')  # PENDING, SETTLED
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
    content = models.TextField()
    founder_feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'partner_reports'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"rep-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)
