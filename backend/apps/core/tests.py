from apps.bookings.models import Booking, BookingStatus
from apps.core.testing_utils import BaseAPITestCase, make_business, make_service, make_staff, make_user
from apps.core.utils import local_today
from apps.queues.models import QueueEntry, QueueStatus


class PublicStatsViewTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user(role='BUSINESS_OWNER', email='stats-owner@example.test')
        self.biz = make_business(self.owner)
        self.service = make_service(self.biz)
        self.staff = make_staff(self.biz)
        self.customer = make_user(role='CUSTOMER', email='stats-customer@example.test')

    def test_response_includes_active_queue_and_todays_bookings(self):
        QueueEntry.objects.create(
            business=self.biz, customer_name='Mijoz 1', status=QueueStatus.WAITING,
        )
        QueueEntry.objects.create(
            business=self.biz, customer_name='Mijoz 2', status=QueueStatus.COMPLETED,
        )
        Booking.objects.create(
            business=self.biz, service=self.service, staff=self.staff, customer=self.customer,
            customer_name=self.customer.name, customer_phone='+998900000001',
            booking_date=local_today(), start_time='10:00', end_time='10:30',
            total_price_uzs=self.service.price_uzs, status=BookingStatus.CONFIRMED,
        )
        Booking.objects.create(
            business=self.biz, service=self.service, staff=self.staff, customer=self.customer,
            customer_name=self.customer.name, customer_phone='+998900000002',
            booking_date=local_today(), start_time='11:00', end_time='11:30',
            total_price_uzs=self.service.price_uzs, status=BookingStatus.CANCELLED,
        )

        response = self.client.get('/api/public-stats')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for key in ('businesses', 'customers', 'queues', 'bookings', 'activeQueueCount', 'todaysBookingsCount'):
            self.assertIn(key, data)
        self.assertEqual(data['activeQueueCount'], 1)  # only the WAITING entry
        self.assertEqual(data['todaysBookingsCount'], 1)  # only the CONFIRMED one counts

    def test_endpoint_is_public(self):
        response = self.client.get('/api/public-stats')
        self.assertEqual(response.status_code, 200)
