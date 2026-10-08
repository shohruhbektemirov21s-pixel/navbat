from unittest.mock import patch

from django.test import override_settings

from apps.core.testing_utils import BaseAPITestCase, make_category, make_city, make_user
from apps.marketplace.models import Business, BusinessApplication, BusinessApplicationStatus
from .admin_bot import handle_update
from .bot import handle_update as public_update


@override_settings(TELEGRAM_ADMIN_USER_IDS=['12345'], TELEGRAM_ADMIN_REVIEWER_EMAIL='founder@example.test',
                   TELEGRAM_ADMIN_BOT_TOKEN='admin-test-token', TELEGRAM_BOT_TOKEN='')
class PrivateAdminBotTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.founder = make_user(role='FOUNDER', email='founder@example.test')
        self.application = BusinessApplication.objects.create(
            applicant=make_user(), telegram_chat_id='', name='Test clinic', category=make_category(),
            city=make_city(), address='Test street 1', phone='+998901234567',
            status=BusinessApplicationStatus.PENDING,
        )
        self.api_patch = patch('apps.notifications.admin_bot.api', return_value=True)
        self.api = self.api_patch.start()
        self.addCleanup(self.api_patch.stop)

    def callback(self, action='approve', sender=12345, chat=None, kind='private'):
        return {'callback_query': {'id': 'callback-1', 'from': {'id': sender},
                'data': f'{action}:{self.application.id}',
                'message': {'message_id': 5, 'chat': {'id': sender if chat is None else chat, 'type': kind}}}}

    def message(self, text, sender=12345):
        return {'message': {'from': {'id': sender}, 'chat': {'id': sender, 'type': 'private'}, 'text': text}}

    def test_unlisted_sender_cannot_approve_even_if_database_founder(self):
        self.founder.telegram_chat_id = '9999'
        self.founder.save()
        handle_update(self.callback(sender=9999))
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, BusinessApplicationStatus.PENDING)
        self.assertFalse(Business.objects.exists())

    @override_settings(TELEGRAM_ADMIN_USER_IDS=[])
    def test_empty_allowlist_denies_everyone(self):
        handle_update(self.callback())
        self.assertFalse(Business.objects.exists())

    def test_owner_cannot_approve_from_group_or_other_chat(self):
        handle_update(self.callback(kind='group'))
        handle_update(self.callback(chat=7777))
        self.assertFalse(Business.objects.exists())

    def test_owner_approval_creates_exactly_one_business_and_records_reviewer(self):
        handle_update(self.callback())
        handle_update(self.callback())
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, BusinessApplicationStatus.APPROVED)
        self.assertEqual(self.application.reviewed_by, self.founder)
        self.assertEqual(Business.objects.count(), 1)
        self.assertEqual(self.application.applicant.role, 'BUSINESS_OWNER')

    def test_suspended_reviewer_cannot_approve(self):
        self.founder.status = 'SUSPENDED'
        self.founder.save()
        handle_update(self.callback())
        self.assertFalse(Business.objects.exists())

    def test_rejection_requires_reason_from_same_owner(self):
        handle_update(self.callback('reject'))
        handle_update(self.message('Forged reason', sender=9999))
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, BusinessApplicationStatus.PENDING)
        handle_update(self.message('Noto‘g‘ri manzil'))
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, BusinessApplicationStatus.REJECTED)
        self.assertEqual(self.application.reject_reason, 'Noto‘g‘ri manzil')
        self.assertEqual(self.application.reviewed_by, self.founder)

    def test_cancel_clears_rejection_prompt(self):
        handle_update(self.callback('reject'))
        handle_update(self.message('/bekor'))
        handle_update(self.message('Accidental text'))
        self.application.refresh_from_db()
        self.assertEqual(self.application.awaiting_reject_from, '')
        self.assertEqual(self.application.status, BusinessApplicationStatus.PENDING)

    def test_public_bot_cannot_review_when_private_bot_is_configured(self):
        self.founder.telegram_chat_id = '12345'
        self.founder.save()
        callback = self.callback()
        callback['callback_query']['data'] = f'bizapp_approve:{self.application.id}'
        with patch('apps.notifications.bot.telegram_api'):
            public_update(callback)
        self.assertFalse(Business.objects.exists())

    def test_public_bot_info_does_not_disclose_admin_identity_or_token(self):
        response = self.client.get('/api/telegram/bot-info')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('admin-test-token', response.content.decode())
        self.assertNotIn('12345', response.content.decode())

    def test_long_markup_rejection_reason_is_sent_as_bounded_plain_text(self):
        handle_update(self.callback('reject'))
        handle_update(self.message('<&' * 1000))
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, BusinessApplicationStatus.REJECTED)
        payload = self.api.call_args.args[1]
        self.assertLessEqual(len(payload['text']), 4000)
        self.assertNotIn('parse_mode', payload)
