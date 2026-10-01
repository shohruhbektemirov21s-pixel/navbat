from datetime import timedelta

from django.utils import timezone

from apps.authentication.models import UserRole
from apps.core.testing_utils import BaseAPITestCase, login_as, make_business, make_service, make_staff, make_user
from apps.marketplace.models import Staff

from .models import Booking, BookingStatus


def tomorrow():
    return timezone.localdate() + timedelta(days=1)


class BookingCreationTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='bk-owner@example.test')
        self.biz = make_business(self.owner)
        self.service = make_service(self.biz, duration_minutes=30)
        self.staff = make_staff(self.biz)
        self.customer1 = make_user(role=UserRole.CUSTOMER, email='bk-cust1@example.test', phone='+998901111111')
        self.customer2 = make_user(role=UserRole.CUSTOMER, email='bk-cust2@example.test', phone='+998902222222')

    def _payload(self, **overrides):
        payload = {
            'business_id': self.biz.id, 'service_id': self.service.id, 'staff_id': self.staff.id,
            'booking_date': tomorrow().isoformat(), 'start_time': '10:00',
        }
        payload.update(overrides)
        return payload

    def test_create_booking_success(self):
        login_as(self.client, self.customer1)
        response = self.client.post('/api/bookings', self._payload(), format='json')
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(Booking.objects.filter(business=self.biz).count(), 1)

    def test_overlapping_booking_for_same_staff_slot_is_rejected(self):
        login_as(self.client, self.customer1)
        first = self.client.post('/api/bookings', self._payload(), format='json')
        self.assertEqual(first.status_code, 201, first.content)

        login_as(self.client, self.customer2)
        second = self.client.post('/api/bookings', self._payload(), format='json')
        self.assertIn(second.status_code, (400, 409))
        self.assertEqual(Booking.objects.filter(business=self.biz).count(), 1)

    def test_missing_start_time_returns_400_not_500(self):
        login_as(self.client, self.customer1)
        payload = self._payload()
        del payload['start_time']
        response = self.client.post('/api/bookings', payload, format='json')
        self.assertEqual(response.status_code, 400)

    def test_missing_booking_date_returns_400_not_500(self):
        login_as(self.client, self.customer1)
        payload = self._payload()
        del payload['booking_date']
        response = self.client.post('/api/bookings', payload, format='json')
        self.assertEqual(response.status_code, 400)

    def test_invalid_start_time_format_returns_400(self):
        login_as(self.client, self.customer1)
        response = self.client.post('/api/bookings', self._payload(start_time='not-a-time'), format='json')
        self.assertEqual(response.status_code, 400)

    def test_service_from_other_business_is_rejected(self):
        other_owner = make_user(role=UserRole.BUSINESS_OWNER, email='bk-owner2@example.test')
        other_biz = make_business(other_owner)
        other_service = make_service(other_biz)
        login_as(self.client, self.customer1)
        response = self.client.post('/api/bookings', self._payload(service_id=other_service.id), format='json')
        self.assertEqual(response.status_code, 400)

    def test_staff_from_other_business_is_rejected(self):
        other_owner = make_user(role=UserRole.BUSINESS_OWNER, email='bk-owner3@example.test')
        other_biz = make_business(other_owner)
        other_staff = make_staff(other_biz)
        login_as(self.client, self.customer1)
        response = self.client.post('/api/bookings', self._payload(staff_id=other_staff.id), format='json')
        self.assertEqual(response.status_code, 400)

    def test_unknown_business_returns_404(self):
        login_as(self.client, self.customer1)
        response = self.client.post('/api/bookings', self._payload(business_id='biz-does-not-exist'), format='json')
        self.assertEqual(response.status_code, 404)


class BookingAccessControlTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='bk-ac-owner@example.test')
        self.biz = make_business(self.owner)
        self.other_owner = make_user(role=UserRole.BUSINESS_OWNER, email='bk-ac-owner2@example.test')
        self.other_biz = make_business(self.other_owner)
        self.service = make_service(self.biz, duration_minutes=30)
        self.staff = make_staff(self.biz)
        self.customer = make_user(role=UserRole.CUSTOMER, email='bk-ac-cust@example.test')
        self.other_customer = make_user(role=UserRole.CUSTOMER, email='bk-ac-cust2@example.test')
        self.booking = Booking.objects.create(
            business=self.biz, service=self.service, staff=self.staff, customer=self.customer,
            customer_name=self.customer.name, customer_phone='+998900000000',
            booking_date=tomorrow(), start_time='11:00', end_time='11:30',
            total_price_uzs=self.service.price_uzs, status=BookingStatus.CONFIRMED,
        )

    def test_other_customer_cannot_cancel_booking(self):
        login_as(self.client, self.other_customer)
        response = self.client.post(f'/api/customer/bookings/{self.booking.id}/cancel', {}, format='json')
        self.assertEqual(response.status_code, 403)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, BookingStatus.CONFIRMED)

    def test_owner_cannot_change_status_of_other_business_booking(self):
        login_as(self.client, self.other_owner)
        response = self.client.post(
            f'/api/business/bookings/{self.booking.id}/status', {'status': BookingStatus.COMPLETED}, format='json'
        )
        self.assertEqual(response.status_code, 403)

    def test_owner_can_change_status_of_own_business_booking(self):
        login_as(self.client, self.owner)
        response = self.client.post(
            f'/api/business/bookings/{self.booking.id}/status', {'status': BookingStatus.COMPLETED}, format='json'
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, BookingStatus.COMPLETED)

    def test_customer_cannot_see_others_bookings_in_list(self):
        login_as(self.client, self.other_customer)
        response = self.client.get('/api/customer/bookings')
        self.assertEqual(response.status_code, 200)
        ids = [b['id'] for b in response.json()]
        self.assertNotIn(self.booking.id, ids)

    def test_owner_cannot_view_other_business_blocked_times(self):
        login_as(self.client, self.other_owner)
        # own business (empty) blocked-times list must never include the other business's data
        self.client.post('/api/business/blocked-times', {
            'business_id': self.other_biz.id,
            'start_datetime': timezone.now().isoformat(),
            'end_datetime': (timezone.now() + timedelta(hours=1)).isoformat(),
        }, format='json')
        response = self.client.get('/api/business/blocked-times')
        self.assertEqual(response.status_code, 200)
        for block in response.json():
            self.assertEqual(block['business_id'], self.other_biz.id)


class CRMCustomersTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='crm-owner@example.test')
        self.biz = make_business(self.owner)
        self.service = make_service(self.biz)
        self.staff = make_staff(self.biz)
        self.customer = make_user(role=UserRole.CUSTOMER, email='crm-cust@example.test')
        Booking.objects.create(
            business=self.biz, service=self.service, staff=self.staff, customer=self.customer,
            customer_name=self.customer.name, customer_phone='+998903334455',
            booking_date=tomorrow(), start_time='09:00', end_time='09:30',
            total_price_uzs=self.service.price_uzs, status=BookingStatus.COMPLETED,
        )

    def test_owner_sees_own_customers(self):
        login_as(self.client, self.owner)
        response = self.client.get('/api/business/crm/customers')
        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['customer_id'], self.customer.id)
        self.assertEqual(rows[0]['completed_visits'], 1)

    def test_customer_without_business_gets_404(self):
        login_as(self.client, self.customer)
        response = self.client.get('/api/business/crm/customers')
        self.assertEqual(response.status_code, 404)

    def test_other_owner_does_not_see_first_owners_customers(self):
        other_owner = make_user(role=UserRole.BUSINESS_OWNER, email='crm-owner2@example.test')
        make_business(other_owner)
        login_as(self.client, other_owner)
        response = self.client.get('/api/business/crm/customers')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
