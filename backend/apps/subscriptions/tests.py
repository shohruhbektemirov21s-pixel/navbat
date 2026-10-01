from apps.authentication.models import UserRole
from apps.core.testing_utils import BaseAPITestCase, login_as, make_business, make_plan, make_user
from apps.marketplace.models import Staff

from .models import AdPromotion, SubscriptionTransaction, TransactionStatus


class SubscriptionRenewalTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        make_plan('PRO', 199000)
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='sub-owner@example.test')
        self.biz = make_business(self.owner, subscription_expires_at=None)
        self.admin = make_user(role=UserRole.ADMIN, email='sub-admin@example.test')

    def test_renew_creates_pending_transaction_without_activating(self):
        login_as(self.client, self.owner)
        response = self.client.post('/api/business/renew-subscription', {'plan_code': 'PRO', 'months': 1}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        tx_id = response.json()['transactionId']
        tx = SubscriptionTransaction.objects.get(id=tx_id)
        self.assertEqual(tx.status, TransactionStatus.PENDING)
        self.biz.refresh_from_db()
        self.assertIsNone(self.biz.subscription_expires_at)

    def test_admin_confirm_activates_the_plan(self):
        login_as(self.client, self.owner)
        renew_resp = self.client.post('/api/business/renew-subscription', {'plan_code': 'PRO', 'months': 1}, format='json')
        tx_id = renew_resp.json()['transactionId']

        login_as(self.client, self.admin)
        confirm_resp = self.client.post(f'/api/admin/subscription-transactions/{tx_id}/confirm', {}, format='json')
        self.assertEqual(confirm_resp.status_code, 200, confirm_resp.content)

        self.biz.refresh_from_db()
        self.assertIsNotNone(self.biz.subscription_expires_at)
        tx = SubscriptionTransaction.objects.get(id=tx_id)
        self.assertEqual(tx.status, TransactionStatus.CONFIRMED)

    def test_non_admin_cannot_confirm_payment(self):
        login_as(self.client, self.owner)
        renew_resp = self.client.post('/api/business/renew-subscription', {'plan_code': 'PRO', 'months': 1}, format='json')
        tx_id = renew_resp.json()['transactionId']
        # still logged in as the (non-admin) owner
        response = self.client.post(f'/api/admin/subscription-transactions/{tx_id}/confirm', {}, format='json')
        self.assertEqual(response.status_code, 403)
        tx = SubscriptionTransaction.objects.get(id=tx_id)
        self.assertEqual(tx.status, TransactionStatus.PENDING)

    def test_staff_member_cannot_request_renewal(self):
        staff_user = make_user(role=UserRole.STAFF, email='sub-staff@example.test')
        Staff.objects.create(business=self.biz, user=staff_user, name='Staffer', title='Ass', is_active=True)
        login_as(self.client, staff_user)
        response = self.client.post('/api/business/renew-subscription', {'plan_code': 'PRO', 'months': 1}, format='json')
        self.assertEqual(response.status_code, 403)


class PromotionTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='promo-owner@example.test')
        self.biz = make_business(self.owner, is_sponsored=False)
        self.admin = make_user(role=UserRole.ADMIN, email='promo-admin@example.test')

    def test_promote_creates_pending_transaction_without_sponsoring(self):
        login_as(self.client, self.owner)
        response = self.client.post('/api/business/promote', {'duration_days': 30}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        tx = SubscriptionTransaction.objects.get(id=response.json()['transactionId'])
        self.assertEqual(tx.status, TransactionStatus.PENDING)
        self.biz.refresh_from_db()
        self.assertFalse(self.biz.is_sponsored)
        self.assertFalse(AdPromotion.objects.filter(business=self.biz).exists())

    def test_admin_confirm_activates_sponsorship(self):
        login_as(self.client, self.owner)
        promo_resp = self.client.post('/api/business/promote', {'duration_days': 30}, format='json')
        tx_id = promo_resp.json()['transactionId']

        login_as(self.client, self.admin)
        confirm_resp = self.client.post(f'/api/admin/subscription-transactions/{tx_id}/confirm', {}, format='json')
        self.assertEqual(confirm_resp.status_code, 200, confirm_resp.content)

        self.biz.refresh_from_db()
        self.assertTrue(self.biz.is_sponsored)
        self.assertTrue(AdPromotion.objects.filter(business=self.biz, status='ACTIVE').exists())
