from apps.authentication.models import UserRole
from apps.core.testing_utils import BaseAPITestCase, login_as, make_business, make_user

from .models import CRMLead, LeadStage, PartnerCommission, PartnerReport


class CRMLeadScopingTests(BaseAPITestCase):
    """Two different OPERATING_PARTNER accounts must not see/touch each other's leads."""

    def setUp(self):
        super().setUp()
        self.founder = make_user(role=UserRole.FOUNDER, email='crm-founder@example.test')
        self.partner_a = make_user(role=UserRole.OPERATING_PARTNER, email='crm-partner-a@example.test')
        self.partner_b = make_user(role=UserRole.OPERATING_PARTNER, email='crm-partner-b@example.test')
        self.lead_a = CRMLead.objects.create(
            id='lead-a', business_name='A Salon', contact_person='Ali', phone='+998900000001',
            status=LeadStage.LEAD, assigned_to=self.partner_a,
        )

    def test_partner_cannot_list_another_partners_lead(self):
        login_as(self.client, self.partner_b)
        resp = self.client.get('/api/partner/crm/leads')
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('lead-a', [row['id'] for row in resp.json()])

    def test_partner_cannot_modify_another_partners_lead(self):
        login_as(self.client, self.partner_b)
        resp = self.client.put('/api/partner/crm/leads/lead-a', {'business_name': 'Hijacked'}, format='json')
        self.assertEqual(resp.status_code, 404)

    def test_owning_partner_can_modify_own_lead(self):
        login_as(self.client, self.partner_a)
        resp = self.client.put('/api/partner/crm/leads/lead-a', {'business_name': 'A Salon Updated'}, format='json')
        self.assertEqual(resp.status_code, 200)

    def test_founder_sees_all_leads(self):
        login_as(self.client, self.founder)
        resp = self.client.get('/api/partner/crm/leads')
        self.assertIn('lead-a', [row['id'] for row in resp.json()])


class CommissionSettleTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.founder = make_user(role=UserRole.FOUNDER, email='comm-founder@example.test')
        self.partner = make_user(role=UserRole.OPERATING_PARTNER, email='comm-partner@example.test')
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='comm-owner@example.test')
        self.biz = make_business(self.owner)
        self.commission = PartnerCommission.objects.create(
            partner=self.partner, business=self.biz, plan_code='PRO', total_amount_uzs=1000000,
            partner_rate=0.30, amount_uzs=300000, navbatbor_share_uzs=700000, period_month='2026-01',
            status='PENDING',
        )

    def test_founder_can_settle_pending_commission(self):
        login_as(self.client, self.founder)
        response = self.client.post(f'/api/partner/commissions/{self.commission.id}/settle', {
            'payout_notes': 'Naqd to‘landi',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.commission.refresh_from_db()
        self.assertEqual(self.commission.status, 'PAID')
        self.assertIsNotNone(self.commission.paid_at)

    def test_partner_cannot_settle_own_commission(self):
        login_as(self.client, self.partner)
        response = self.client.post(f'/api/partner/commissions/{self.commission.id}/settle', {}, format='json')
        self.assertEqual(response.status_code, 403)
        self.commission.refresh_from_db()
        self.assertEqual(self.commission.status, 'PENDING')

    def test_settling_an_already_paid_commission_fails(self):
        self.commission.status = 'PAID'
        self.commission.save(update_fields=['status'])
        login_as(self.client, self.founder)
        response = self.client.post(f'/api/partner/commissions/{self.commission.id}/settle', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_settle_unknown_commission_returns_404(self):
        login_as(self.client, self.founder)
        response = self.client.post('/api/partner/commissions/com-does-not-exist/settle', {}, format='json')
        self.assertEqual(response.status_code, 404)


class PartnerReportReviewTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.founder = make_user(role=UserRole.FOUNDER, email='rep-founder@example.test')
        self.partner = make_user(role=UserRole.OPERATING_PARTNER, email='rep-partner@example.test')
        self.report = PartnerReport.objects.create(
            partner=self.partner, report_type='WEEKLY', period_label='2026-W01',
            content='Haftalik hisobot matni', status='SUBMITTED',
        )

    def test_founder_can_review_report(self):
        login_as(self.client, self.founder)
        response = self.client.post(f'/api/partner/reports/{self.report.id}/review', {
            'founder_feedback': 'A\'lo ish!',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, 'REVIEWED')
        self.assertEqual(self.report.founder_feedback, "A'lo ish!")
        self.assertIsNotNone(self.report.reviewed_at)

    def test_partner_cannot_review_report(self):
        login_as(self.client, self.partner)
        response = self.client.post(f'/api/partner/reports/{self.report.id}/review', {}, format='json')
        self.assertEqual(response.status_code, 403)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, 'SUBMITTED')

    def test_review_unknown_report_returns_404(self):
        login_as(self.client, self.founder)
        response = self.client.post('/api/partner/reports/rep-does-not-exist/review', {}, format='json')
        self.assertEqual(response.status_code, 404)
