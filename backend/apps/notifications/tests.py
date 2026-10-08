from unittest.mock import patch

from django.test import override_settings

from apps.authentication.models import UserRole
from apps.core.testing_utils import BaseAPITestCase, login_as, make_user

from .bot import handle_update, _parse_hours_text


@override_settings(TELEGRAM_BOT_USERNAME='NavbatBorTestBot')
class BusinessConnectLinkViewTests(BaseAPITestCase):
    def test_anonymous_gets_plain_bizapp_payload(self):
        response = self.client.post('/api/telegram/business-connect-link')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual(data['botUsername'], 'NavbatBorTestBot')
        self.assertEqual(data['deepLink'], 'https://t.me/NavbatBorTestBot?start=bizapp')

    def test_authenticated_caller_gets_user_scoped_payload(self):
        user = make_user(role=UserRole.CUSTOMER, email='connectlink@example.test')
        login_as(self.client, user)
        response = self.client.post('/api/telegram/business-connect-link')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['deepLink'], f'https://t.me/NavbatBorTestBot?start=bizapp_u{user.id}')

    @override_settings(TELEGRAM_BOT_USERNAME='')
    def test_returns_503_when_bot_not_configured(self):
        response = self.client.post('/api/telegram/business-connect-link')
        self.assertEqual(response.status_code, 503)


class BusinessApplicationHoursParsingTests(BaseAPITestCase):
    """`_parse_hours_text` is the free-text -> 7-day schedule parser used by the ASK_HOURS step."""

    def test_day_range_with_time_range(self):
        parsed = _parse_hours_text('Dushanba-Shanba, 09:00-18:00')
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed[1], ('09:00', '18:00', False))  # Monday open
        self.assertEqual(parsed[0], ('09:00', '18:00', True))   # Sunday closed

    def test_every_day(self):
        parsed = _parse_hours_text('Har kuni, 10:00-19:00')
        self.assertTrue(all(not is_closed for _open, _close, is_closed in parsed.values()))

    def test_unparseable_text_returns_none(self):
        self.assertIsNone(_parse_hours_text('tushunarsiz matn'))

    def test_inverted_time_range_returns_none(self):
        self.assertIsNone(_parse_hours_text('Har kuni, 18:00-09:00'))


@override_settings(TELEGRAM_BOT_TOKEN='', TELEGRAM_ADMIN_BOT_TOKEN='')
class BusinessApplicationBotFlowTests(BaseAPITestCase):
    """End-to-end conversation flow driven directly through handle_update() (no real Telegram)."""

    def setUp(self):
        super().setUp()
        api_mock = patch('apps.notifications.bot.telegram_api', return_value=True)
        api_mock.start()
        self.addCleanup(api_mock.stop)
        from apps.core.testing_utils import make_category, make_city
        self.category = make_category()
        self.city = make_city()
        self.chat_id = '700001'

    def _message(self, text, update_id=1):
        return {'update_id': update_id, 'message': {
            'chat': {'id': int(self.chat_id), 'type': 'private'}, 'from': {'id': int(self.chat_id)}, 'text': text,
        }}

    def _callback(self, data, update_id=1, from_id=None):
        return {'update_id': update_id, 'callback_query': {
            'id': f'cb{update_id}', 'from': {'id': from_id or int(self.chat_id)}, 'data': data,
            'message': {'chat': {'id': from_id or int(self.chat_id), 'type': 'private'}, 'message_id': update_id},
        }}

    def test_full_conversation_creates_pending_application(self):
        from apps.marketplace.application_models import BusinessApplication, BusinessApplicationStatus
        from apps.marketplace.application_models import BusinessApplicationStep as Step

        with patch('apps.notifications.bot.send_telegram_message', return_value=True):
            handle_update(self._message('/start bizapp', 1))
            application = BusinessApplication.objects.get(telegram_chat_id=self.chat_id)
            self.assertEqual(application.step, Step.ASK_NAME)

            handle_update(self._message('Mening Do‘konim', 2))
            application.refresh_from_db()
            self.assertEqual(application.step, Step.ASK_CATEGORY)

            handle_update(self._callback('bizapp_cat:0', 3))
            application.refresh_from_db()
            self.assertEqual(application.step, Step.ASK_CITY)
            self.assertIsNotNone(application.category_id)

            handle_update(self._callback('bizapp_region:qa', 4))
            application.refresh_from_db()
            self.assertEqual(application.step, Step.ASK_DISTRICT)

            handle_update(self._callback('bizapp_district:qa:qarshi-shahri', 5))
            handle_update(self._message('Amir Temur ko‘chasi 5', 6))
            handle_update(self._message('not-a-phone', 7))
            application.refresh_from_db()
            self.assertEqual(application.step, Step.ASK_PHONE)  # bad phone does not advance

            handle_update(self._message('+998901234567', 8))
            handle_update(self._message('Dushanba-Juma, 09:00-18:00', 9))
            application.refresh_from_db()
            self.assertEqual(application.step, Step.ASK_DESCRIPTION)
            self.assertEqual(application.hours.count(), 7)

            handle_update(self._message('/skip', 10))
            application.refresh_from_db()
            self.assertEqual(application.step, Step.ASK_PHOTOS)

            # /done with zero photos must not advance.
            handle_update(self._message('/done', 11))
            application.refresh_from_db()
            self.assertEqual(application.step, Step.ASK_PHOTOS)

        fake_file = {'file_path': 'photos/f1.jpg'}
        png_bytes = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
            b'\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB\x60\x82'
        )

        class _FakeResponse:
            content = png_bytes

            def raise_for_status(self):
                pass

        with patch('apps.notifications.bot.send_telegram_message', return_value=True), \
                patch('apps.notifications.bot.telegram_api', return_value=fake_file), \
                patch('apps.notifications.bot.requests.get', return_value=_FakeResponse()):
            handle_update({'update_id': 12, 'message': {
                'chat': {'id': int(self.chat_id), 'type': 'private'}, 'from': {'id': int(self.chat_id)},
                'photo': [{'file_id': 'f1', 'width': 10, 'height': 10, 'file_size': 10}],
            }})
            application.refresh_from_db()
            self.assertEqual(application.photos.count(), 1)

            handle_update(self._message('/done', 13))
            application.refresh_from_db()
            self.assertEqual(application.step, Step.CONFIRM)

            handle_update(self._callback('bizapp_submit', 14))
            application.refresh_from_db()
            self.assertEqual(application.status, BusinessApplicationStatus.PENDING)
            self.assertEqual(application.step, Step.DONE)

    def test_starting_again_while_pending_does_not_create_a_duplicate(self):
        from apps.marketplace.application_models import BusinessApplication, BusinessApplicationStatus

        BusinessApplication.objects.create(
            telegram_chat_id=self.chat_id, telegram_user_id=self.chat_id, name='Allaqachon yuborilgan',
            status=BusinessApplicationStatus.PENDING,
        )
        with patch('apps.notifications.bot.send_telegram_message', return_value=True) as mocked:
            handle_update(self._message('/start bizapp', 1))
        self.assertEqual(BusinessApplication.objects.filter(telegram_chat_id=self.chat_id).count(), 1)
        self.assertTrue(mocked.called)

    def test_approve_and_reject_callbacks_require_admin_chat(self):
        from apps.marketplace.application_models import BusinessApplication, BusinessApplicationStatus

        application = BusinessApplication.objects.create(
            telegram_chat_id=self.chat_id, telegram_user_id=self.chat_id, name='Ruxsatsiz test',
            category=self.category, city=self.city, address='X', phone='+998900000000',
            status=BusinessApplicationStatus.PENDING,
        )
        with patch('apps.notifications.bot.send_telegram_message', return_value=True):
            handle_update(self._callback(f'bizapp_approve:{application.id}', 1, from_id=123456))
        application.refresh_from_db()
        self.assertEqual(application.status, BusinessApplicationStatus.PENDING)  # unchanged: not an admin

    def test_bizapp_u_suffix_is_ignored_unless_chat_already_linked_to_that_user(self):
        """A crafted `/start bizapp_u<id>` must never attribute the application to a stranger
        who never touched this chat — only when telegram_chat_id already proves ownership."""
        from apps.marketplace.application_models import BusinessApplication

        victim = make_user(role=UserRole.CUSTOMER, email='victim@example.test')  # never linked this chat
        with patch('apps.notifications.bot.send_telegram_message', return_value=True):
            handle_update(self._message(f'/start bizapp_u{victim.id}', 1))
        application = BusinessApplication.objects.get(telegram_chat_id=self.chat_id)
        self.assertIsNone(application.applicant_id)

    def test_bizapp_u_suffix_is_honored_when_chat_is_linked_to_that_user(self):
        from apps.marketplace.application_models import BusinessApplication

        owner = make_user(role=UserRole.CUSTOMER, email='linked@example.test')
        owner.telegram_chat_id = self.chat_id
        owner.save(update_fields=['telegram_chat_id'])
        with patch('apps.notifications.bot.send_telegram_message', return_value=True):
            handle_update(self._message(f'/start bizapp_u{owner.id}', 1))
        application = BusinessApplication.objects.get(telegram_chat_id=self.chat_id)
        self.assertEqual(application.applicant_id, owner.id)

    def test_reject_callback_is_race_safe_against_double_click(self):
        """Two admins clicking 'reject' on the same application concurrently must not both
        succeed in claiming awaiting_reject_from — the second must see 'already reviewed'."""
        from apps.marketplace.application_models import BusinessApplication, BusinessApplicationStatus

        admin1 = make_user(role=UserRole.ADMIN, email='reject-admin1@example.test')
        admin1.telegram_chat_id = '800001'
        admin1.save(update_fields=['telegram_chat_id'])
        admin2 = make_user(role=UserRole.ADMIN, email='reject-admin2@example.test')
        admin2.telegram_chat_id = '800002'
        admin2.save(update_fields=['telegram_chat_id'])

        application = BusinessApplication.objects.create(
            telegram_chat_id=self.chat_id, telegram_user_id=self.chat_id, name='Race test',
            category=self.category, city=self.city, address='X', phone='+998900000000',
            status=BusinessApplicationStatus.PENDING,
        )
        with patch('apps.notifications.bot.send_telegram_message', return_value=True):
            handle_update(self._callback(f'bizapp_reject:{application.id}', 1, from_id=800001))
            application.refresh_from_db()
            # Simulate the application having been rejected by admin1 in between admin2's
            # read and write by flipping status directly, then confirm admin2's click is rejected.
            application.status = BusinessApplicationStatus.REJECTED
            application.save(update_fields=['status'])
            handle_update(self._callback(f'bizapp_reject:{application.id}', 2, from_id=800002))
        application.refresh_from_db()
        self.assertEqual(application.awaiting_reject_from, '800001')  # admin2's click never overwrote it
