from apps.authentication.models import UserRole
from apps.core.testing_utils import (
    BaseAPITestCase, login_as, make_business, make_category, make_city, make_service, make_user, unique_suffix,
)

from .application_models import BusinessApplicationStatus
from .models import BusinessStatus, Review
from .services import approve_business_application, reject_business_application


class BusinessOwnershipIDORTests(BaseAPITestCase):
    """Every `business/*` management endpoint resolves strictly to the caller's own business."""

    def setUp(self):
        super().setUp()
        self.owner1 = make_user(role=UserRole.BUSINESS_OWNER, email='owner1@example.test')
        self.owner2 = make_user(role=UserRole.BUSINESS_OWNER, email='owner2@example.test')
        self.biz1 = make_business(self.owner1)
        self.biz2 = make_business(self.owner2)
        self.service1 = make_service(self.biz1)
        self.service2 = make_service(self.biz2)

    def test_owner_cannot_delete_other_owners_service(self):
        login_as(self.client, self.owner1)
        response = self.client.delete(f'/api/business/services/{self.service2.id}')
        self.assertEqual(response.status_code, 404)
        self.service2.refresh_from_db()  # still exists

    def test_owner_can_delete_own_service(self):
        login_as(self.client, self.owner1)
        response = self.client.delete(f'/api/business/services/{self.service1.id}')
        self.assertEqual(response.status_code, 200)

    def test_owner_sees_only_own_services(self):
        login_as(self.client, self.owner1)
        response = self.client.get('/api/business/services')
        self.assertEqual(response.status_code, 200)
        ids = [item['id'] for item in response.json()]
        self.assertIn(self.service1.id, ids)
        self.assertNotIn(self.service2.id, ids)

    def test_customer_without_business_gets_404_creating_a_service(self):
        customer = make_user(role=UserRole.CUSTOMER, email='cust-no-biz@example.test')
        login_as(self.client, customer)
        response = self.client.post('/api/business/services', {'name': 'Hack xizmat'}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_customer_without_business_gets_404_updating_hours(self):
        customer = make_user(role=UserRole.CUSTOMER, email='cust-no-biz-2@example.test')
        login_as(self.client, customer)
        response = self.client.put('/api/business/working-hours', {'hours': []}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_staff_member_cannot_edit_profile_owner_only(self):
        """Active staff of biz1 can view but not edit the owner-only profile endpoint."""
        from .models import Staff

        staff_user = make_user(role=UserRole.STAFF, email='staffer@example.test')
        Staff.objects.create(business=self.biz1, user=staff_user, name='Staffer', title='Ass', is_active=True)
        login_as(self.client, staff_user)
        get_resp = self.client.get('/api/business/profile')
        self.assertEqual(get_resp.status_code, 200)
        put_resp = self.client.put('/api/business/profile', {'name': 'Hacked Name'}, format='json')
        self.assertEqual(put_resp.status_code, 403)


class BusinessVisibilityTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner1 = make_user(role=UserRole.BUSINESS_OWNER, email='pend-owner@example.test')
        self.owner2 = make_user(role=UserRole.BUSINESS_OWNER, email='other-owner@example.test')
        self.pending_biz = make_business(self.owner1, status=BusinessStatus.PENDING)

    def test_public_cannot_see_pending_business(self):
        response = self.client.get(f'/api/businesses/{self.pending_biz.slug}')
        self.assertEqual(response.status_code, 404)

    def test_owner_can_see_own_pending_business(self):
        login_as(self.client, self.owner1)
        response = self.client.get(f'/api/businesses/{self.pending_biz.slug}')
        self.assertEqual(response.status_code, 200)

    def test_unrelated_owner_cannot_see_pending_business(self):
        login_as(self.client, self.owner2)
        response = self.client.get(f'/api/businesses/{self.pending_biz.slug}')
        self.assertEqual(response.status_code, 404)


class AdminReviewsTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='rev-owner@example.test')
        self.biz = make_business(self.owner)
        self.customer = make_user(role=UserRole.CUSTOMER, email='rev-customer@example.test')
        self.review = Review.objects.create(business=self.biz, customer=self.customer, rating=4, comment='Yaxshi')

    def test_founder_can_list_and_delete_review(self):
        founder = make_user(role=UserRole.FOUNDER, email='rev-founder@example.test')
        login_as(self.client, founder)
        list_resp = self.client.get('/api/admin/reviews')
        self.assertEqual(list_resp.status_code, 200)
        self.assertTrue(any(r['id'] == self.review.id for r in list_resp.json()))

        delete_resp = self.client.post(f'/api/admin/reviews/{self.review.id}/delete')
        self.assertEqual(delete_resp.status_code, 200)
        self.assertFalse(Review.objects.filter(id=self.review.id).exists())

    def test_non_admin_cannot_delete_review(self):
        login_as(self.client, self.customer)
        response = self.client.post(f'/api/admin/reviews/{self.review.id}/delete')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Review.objects.filter(id=self.review.id).exists())

    def test_non_admin_cannot_list_admin_reviews(self):
        login_as(self.client, self.customer)
        response = self.client.get('/api/admin/reviews')
        self.assertEqual(response.status_code, 403)


class OldBusinessRegisterRouteRemovedTests(BaseAPITestCase):
    """The self-service web registration flow is replaced by the Telegram bot application flow.

    `businesses/register` is no longer a dedicated route; it now falls through to the
    `businesses/<slug>` detail view (GET-only), so an unauthenticated POST is rejected
    (405) rather than silently creating a PENDING business as the old view did — either
    way, nothing gets created.
    """

    def test_old_register_route_no_longer_creates_a_business(self):
        from .models import Business

        before = Business.objects.count()
        response = self.client.post('/api/businesses/register', {'name': 'Hack biznes'}, format='json')
        self.assertIn(response.status_code, (404, 405))
        self.assertEqual(Business.objects.count(), before)


class BusinessApplicationServiceTests(BaseAPITestCase):
    """approve_business_application() / reject_business_application() at the service-function level."""

    def setUp(self):
        super().setUp()
        self.category = make_category()
        self.city = make_city()
        self.admin = make_user(role=UserRole.FOUNDER, email='bizapp-founder@example.test')

    def _make_application(self, **extra):
        from .application_models import BusinessApplication, BusinessApplicationHours, BusinessApplicationPhoto

        defaults = {
            'telegram_chat_id': f'chat-{unique_suffix()}',
            'telegram_user_id': 'tgu-1',
            'telegram_username': 'applicant',
            'name': 'Yangi Salon',
            'category': self.category,
            'city': self.city,
            'district': 'Markaz',
            'address': 'Amir Temur ko‘chasi 1',
            'phone': '+998901234567',
            'description': 'Go‘zallik saloni',
            'status': BusinessApplicationStatus.PENDING,
        }
        defaults.update(extra)
        application = BusinessApplication.objects.create(**defaults)
        for dow in range(7):
            BusinessApplicationHours.objects.create(
                application=application, day_of_week=dow, open_time='09:00', close_time='18:00', is_closed=dow == 0,
            )
        BusinessApplicationPhoto.objects.create(application=application, order=0)
        return application

    def test_approve_creates_business_and_hours_and_marks_approved(self):
        application = self._make_application()
        business = approve_business_application(application, self.admin)

        self.assertEqual(business.name, 'Yangi Salon')
        self.assertEqual(business.status, BusinessStatus.APPROVED)
        self.assertTrue(business.is_verified)
        self.assertEqual(business.hours.count(), 7)
        self.assertTrue(business.hours.filter(day_of_week=0, is_closed=True).exists())
        self.assertTrue(business.hours.filter(day_of_week=1, is_closed=False, open_time='09:00').exists())

        application.refresh_from_db()
        self.assertEqual(application.status, BusinessApplicationStatus.APPROVED)
        self.assertEqual(application.resulting_business_id, business.id)
        self.assertEqual(application.reviewed_by_id, self.admin.id)
        self.assertIsNotNone(application.reviewed_at)

    def test_approve_reuses_existing_user_with_same_chat_id(self):
        owner = make_user(role=UserRole.CUSTOMER, email='existing-owner@example.test', telegram_chat_id='chat-reuse')
        application = self._make_application(telegram_chat_id='chat-reuse')
        business = approve_business_application(application, self.admin)
        owner.refresh_from_db()
        self.assertEqual(business.owner_id, owner.id)
        self.assertEqual(owner.role, UserRole.BUSINESS_OWNER)

    def test_approve_never_downgrades_a_privileged_role(self):
        owner = make_user(role=UserRole.ADMIN, email='admin-owner@example.test', telegram_chat_id='chat-admin-app')
        application = self._make_application(telegram_chat_id='chat-admin-app')
        business = approve_business_application(application, self.admin)
        owner.refresh_from_db()
        self.assertEqual(business.owner_id, owner.id)
        self.assertEqual(owner.role, UserRole.ADMIN)  # never downgraded to BUSINESS_OWNER

    def test_approve_missing_category_raises_value_error(self):
        application = self._make_application(category=None)
        with self.assertRaises(ValueError):
            approve_business_application(application, self.admin)

    def test_reject_sets_status_and_reason(self):
        application = self._make_application()
        reject_business_application(application, self.admin, 'Rasmlar sifatsiz')
        application.refresh_from_db()
        self.assertEqual(application.status, BusinessApplicationStatus.REJECTED)
        self.assertEqual(application.reject_reason, 'Rasmlar sifatsiz')
        self.assertEqual(application.reviewed_by_id, self.admin.id)
        self.assertIsNotNone(application.reviewed_at)


class BusinessApplicationAdminEndpointTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.category = make_category()
        self.city = make_city()
        self.admin = make_user(role=UserRole.FOUNDER, email='bizapp-endpoint-founder@example.test')
        self.customer = make_user(role=UserRole.CUSTOMER, email='bizapp-endpoint-customer@example.test')

    def _make_pending_application(self):
        from .application_models import BusinessApplication

        return BusinessApplication.objects.create(
            telegram_chat_id=f'chat-{unique_suffix()}', telegram_user_id='tgu-2', name='Endpoint Biznes',
            category=self.category, city=self.city, address='Manzil', phone='+998901112233',
            status=BusinessApplicationStatus.PENDING,
        )

    def test_non_admin_cannot_list_applications(self):
        login_as(self.client, self.customer)
        response = self.client.get('/api/admin/business-applications')
        self.assertEqual(response.status_code, 403)

    def test_admin_can_list_pending_applications(self):
        application = self._make_pending_application()
        login_as(self.client, self.admin)
        response = self.client.get('/api/admin/business-applications')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(any(item['id'] == application.id for item in data))
        item = next(item for item in data if item['id'] == application.id)
        self.assertEqual(len(item['hours']), 7)
        self.assertIn('photos', item)

    def test_admin_approve_happy_path(self):
        application = self._make_pending_application()
        login_as(self.client, self.admin)
        response = self.client.post(f'/api/admin/business-applications/{application.id}/approve')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIn('business_id', data)
        application.refresh_from_db()
        self.assertEqual(application.status, BusinessApplicationStatus.APPROVED)

    def test_admin_double_approve_returns_400(self):
        application = self._make_pending_application()
        login_as(self.client, self.admin)
        first = self.client.post(f'/api/admin/business-applications/{application.id}/approve')
        self.assertEqual(first.status_code, 200)
        second = self.client.post(f'/api/admin/business-applications/{application.id}/approve')
        self.assertEqual(second.status_code, 400)

    def test_admin_reject_requires_reason(self):
        application = self._make_pending_application()
        login_as(self.client, self.admin)
        response = self.client.post(f'/api/admin/business-applications/{application.id}/reject', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_admin_reject_happy_path(self):
        application = self._make_pending_application()
        login_as(self.client, self.admin)
        response = self.client.post(
            f'/api/admin/business-applications/{application.id}/reject', {'reason': 'Noto‘g‘ri ma’lumot'}, format='json'
        )
        self.assertEqual(response.status_code, 200, response.content)
        application.refresh_from_db()
        self.assertEqual(application.status, BusinessApplicationStatus.REJECTED)
        self.assertEqual(application.reject_reason, 'Noto‘g‘ri ma’lumot')

    def test_non_admin_cannot_approve(self):
        application = self._make_pending_application()
        login_as(self.client, self.customer)
        response = self.client.post(f'/api/admin/business-applications/{application.id}/approve')
        self.assertEqual(response.status_code, 403)
