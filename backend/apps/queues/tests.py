from django.test import TestCase
from django.utils import timezone

from apps.authentication.models import UserRole
from apps.core.testing_utils import BaseAPITestCase, login_as, make_business, make_service, make_staff, make_user

from . import services as queue_services
from .models import PendingActionStatus, QueueEntry, QueueStatus
from .services import allocate_queue_number, join_queue


class QueueNumberingTests(TestCase):
    """Model/service-level: no HTTP involved, exercises the atomic counter directly."""

    def setUp(self):
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='q-owner@example.test')
        self.biz1 = make_business(self.owner)
        self.biz2 = make_business(self.owner)

    def test_numbers_are_sequential_within_a_business_and_day(self):
        today = timezone.localdate()
        numbers = [allocate_queue_number(self.biz1, today) for _ in range(5)]
        self.assertEqual(numbers, ['A001', 'A002', 'A003', 'A004', 'A005'])

    def test_numbering_is_independent_per_business(self):
        today = timezone.localdate()
        allocate_queue_number(self.biz1, today)
        allocate_queue_number(self.biz1, today)
        first_biz2_number = allocate_queue_number(self.biz2, today)
        self.assertEqual(first_biz2_number, 'A001')

    def test_numbering_is_independent_per_day(self):
        today = timezone.localdate()
        tomorrow = today + timezone.timedelta(days=1)
        allocate_queue_number(self.biz1, today)
        allocate_queue_number(self.biz1, today)
        first_tomorrow_number = allocate_queue_number(self.biz1, tomorrow)
        self.assertEqual(first_tomorrow_number, 'A001')

    def test_join_queue_yields_unique_sequential_numbers(self):
        service = make_service(self.biz1)
        make_staff(self.biz1)
        entries = [
            join_queue(business=self.biz1, customer_name=f'Mijoz {i}', customer_phone='+998900000000',
                       service_id=service.id)
            for i in range(3)
        ]
        numbers = [e.queue_number for e in entries]
        self.assertEqual(numbers, ['A001', 'A002', 'A003'])
        self.assertEqual(len(set(numbers)), 3)


class PublicQueueBoardTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='pub-owner@example.test')
        self.biz = make_business(self.owner)
        self.service = make_service(self.biz)
        self.staff = make_staff(self.biz)
        join_queue(business=self.biz, customer_name='Oybek Yusupov', customer_phone='+998901234567',
                  service_id=self.service.id, staff_id=self.staff.id)

    def test_public_board_never_exposes_phone_number(self):
        response = self.client.get(f'/api/public-queue/{self.biz.slug}')
        self.assertEqual(response.status_code, 200)
        body = response.json()
        serialized = str(body)
        self.assertNotIn('+998901234567', serialized)
        for section in ('serving', 'called', 'waiting'):
            for entry in body[section]:
                self.assertNotIn('customer_phone', entry)
                self.assertNotIn('telegram_chat_id', entry)

    def test_public_board_masks_customer_name(self):
        response = self.client.get(f'/api/public-queue/{self.biz.slug}')
        body = response.json()
        self.assertEqual(len(body['waiting']), 1)
        self.assertNotEqual(body['waiting'][0]['customer_name'], 'Oybek Yusupov')
        self.assertTrue(body['waiting'][0]['customer_name'].startswith('Oybek'))


class QueueBusinessIDORTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner1 = make_user(role=UserRole.BUSINESS_OWNER, email='q-idor-owner1@example.test')
        self.owner2 = make_user(role=UserRole.BUSINESS_OWNER, email='q-idor-owner2@example.test')
        self.biz1 = make_business(self.owner1)
        self.biz2 = make_business(self.owner2)

    def test_owner_cannot_view_other_business_queue(self):
        login_as(self.client, self.owner1)
        response = self.client.get(f'/api/business/{self.biz2.id}/queue')
        self.assertEqual(response.status_code, 403)

    def test_customer_cannot_view_business_queue(self):
        customer = make_user(role=UserRole.CUSTOMER, email='q-idor-cust@example.test')
        login_as(self.client, customer)
        response = self.client.get(f'/api/business/{self.biz1.id}/queue')
        self.assertEqual(response.status_code, 403)

    def test_owner_can_view_own_business_queue(self):
        login_as(self.client, self.owner1)
        response = self.client.get(f'/api/business/{self.biz1.id}/queue')
        self.assertEqual(response.status_code, 200)


class PendingQueueActionTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = make_user(role=UserRole.BUSINESS_OWNER, email='pqa-owner@example.test')
        self.biz = make_business(self.owner)
        self.other_owner = make_user(role=UserRole.BUSINESS_OWNER, email='pqa-owner2@example.test')
        self.other_biz = make_business(self.other_owner)
        self.service = make_service(self.biz)
        self.staff = make_staff(self.biz)
        self.entry = join_queue(business=self.biz, customer_name='Kutuvchi', customer_phone='+998907776655',
                                service_id=self.service.id, staff_id=self.staff.id)

    def test_request_then_confirm_happy_path(self):
        login_as(self.client, self.owner)
        request_resp = self.client.post('/api/queue/next/request', {'business_id': self.biz.id}, format='json')
        self.assertEqual(request_resp.status_code, 200, request_resp.content)
        pending_id = request_resp.json()['pendingActionId']

        confirm_resp = self.client.post('/api/queue/next/confirm', {'pending_action_id': pending_id}, format='json')
        self.assertEqual(confirm_resp.status_code, 200, confirm_resp.content)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.status, QueueStatus.CALLED)

    def test_request_then_cancel(self):
        login_as(self.client, self.owner)
        request_resp = self.client.post('/api/queue/next/request', {'business_id': self.biz.id}, format='json')
        pending_id = request_resp.json()['pendingActionId']

        cancel_resp = self.client.post('/api/queue/pending-cancel', {'pending_action_id': pending_id}, format='json')
        self.assertEqual(cancel_resp.status_code, 200, cancel_resp.content)
        from .models import PendingQueueAction
        action = PendingQueueAction.objects.get(id=pending_id)
        self.assertEqual(action.status, PendingActionStatus.CANCELLED)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.status, QueueStatus.WAITING)

    def test_other_business_owner_cannot_confirm_pending_action(self):
        action, _sent = queue_services.request_next(self.biz, self.owner)
        login_as(self.client, self.other_owner)
        response = self.client.post('/api/queue/next/confirm', {'pending_action_id': action.id}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_other_business_owner_cannot_cancel_pending_action(self):
        action, _sent = queue_services.request_next(self.biz, self.owner)
        login_as(self.client, self.other_owner)
        response = self.client.post('/api/queue/pending-cancel', {'pending_action_id': action.id}, format='json')
        self.assertEqual(response.status_code, 403)
