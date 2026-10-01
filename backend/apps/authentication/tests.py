import uuid

from django.conf import settings
from django.utils import timezone

from apps.core.testing_utils import BaseAPITestCase, STRONG_PASSWORD, auth_headers, login_as, make_user

from .models import TelegramAuthSession, User, UserRole, UserStatus


class RegisterViewTests(BaseAPITestCase):
    def test_register_always_creates_customer_role(self):
        response = self.client.post('/api/auth/register', {
            'name': 'Yangi Foydalanuvchi', 'email': 'newbie@example.test',
            'password': STRONG_PASSWORD, 'role': UserRole.FOUNDER,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['user']['role'], UserRole.CUSTOMER)
        self.assertIn('token', data)
        self.assertIn('refresh', data)
        user = User.objects.get(email='newbie@example.test')
        self.assertEqual(user.role, UserRole.CUSTOMER)

    def test_register_rejects_weak_password(self):
        response = self.client.post('/api/auth/register', {
            'name': 'Kimdir', 'email': 'weak@example.test', 'password': '1234567',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_duplicate_email(self):
        make_user(email='dup@example.test')
        response = self.client.post('/api/auth/register', {
            'name': 'Boshqa', 'email': 'dup@example.test', 'password': STRONG_PASSWORD,
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_phone_with_letters(self):
        response = self.client.post('/api/auth/register', {
            'name': 'Kimdir', 'email': 'badphone@example.test', 'password': STRONG_PASSWORD, 'phone': 'abc1234567',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email='badphone@example.test').exists())

    def test_register_accepts_valid_phone(self):
        response = self.client.post('/api/auth/register', {
            'name': 'Kimdir', 'email': 'goodphone@example.test', 'password': STRONG_PASSWORD, 'phone': '+998901234567',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(User.objects.get(email='goodphone@example.test').phone, '+998901234567')

    def test_register_without_phone_still_works(self):
        response = self.client.post('/api/auth/register', {
            'name': 'Kimdir', 'email': 'nophone@example.test', 'password': STRONG_PASSWORD,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)


class LoginViewTests(BaseAPITestCase):
    def test_login_success_returns_tokens_and_user(self):
        user = make_user(email='login-ok@example.test')
        response = self.client.post('/api/auth/login', {'email': user.email, 'password': STRONG_PASSWORD}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertIn('token', data)
        self.assertIn('refresh', data)
        self.assertEqual(data['user']['email'], user.email)

    def test_login_rejects_inactive_user(self):
        user = make_user(email='inactive@example.test', is_active=False)
        response = self.client.post('/api/auth/login', {'email': user.email, 'password': STRONG_PASSWORD}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_login_rejects_suspended_user(self):
        user = make_user(email='suspended@example.test', status=UserStatus.SUSPENDED)
        response = self.client.post('/api/auth/login', {'email': user.email, 'password': STRONG_PASSWORD}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_login_rejects_wrong_password(self):
        user = make_user(email='wrongpass@example.test')
        response = self.client.post('/api/auth/login', {'email': user.email, 'password': 'NotTheRightOne1!'}, format='json')
        self.assertEqual(response.status_code, 400)


class RefreshLogoutViewTests(BaseAPITestCase):
    def test_refresh_returns_new_token_pair(self):
        user = make_user(email='refresh-ok@example.test')
        tokens, _ = auth_headers(self.client, user.email)
        response = self.client.post('/api/auth/refresh', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertIn('token', data)
        self.assertIn('refresh', data)

    def test_refresh_rejects_garbage_token(self):
        response = self.client.post('/api/auth/refresh', {'refresh': 'not-a-real-token'}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_refresh_rejects_missing_token(self):
        response = self.client.post('/api/auth/refresh', {}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_logout_blacklists_refresh_token(self):
        user = make_user(email='logout-ok@example.test')
        tokens, _ = auth_headers(self.client, user.email)
        logout_resp = self.client.post('/api/auth/logout', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(logout_resp.status_code, 200)
        reuse_resp = self.client.post('/api/auth/refresh', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(reuse_resp.status_code, 401)

    def test_logout_is_idempotent_with_invalid_token(self):
        response = self.client.post('/api/auth/logout', {'refresh': 'garbage'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])


class QuickTelegramLoginTests(BaseAPITestCase):
    def test_dev_phone_login_refused_without_debug_flag(self):
        self.assertFalse(settings.ALLOW_DEV_QUICK_LOGIN)  # sanity: not enabled in the test environment
        response = self.client.post('/api/auth/telegram-quick-login', {'phone': '+998901234567'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_refused_for_unknown_session(self):
        response = self.client.post('/api/auth/telegram-quick-login', {
            'sessionId': 'tgs-does-not-exist', 'code': '123456',
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_refused_while_session_not_yet_confirmed(self):
        session = TelegramAuthSession.objects.create(
            session_id='tgs-pending', code='111222', status='PENDING',
            expires_at=timezone.now() + timezone.timedelta(minutes=5),
        )
        response = self.client.post('/api/auth/telegram-quick-login', {
            'sessionId': session.session_id, 'code': session.code,
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_succeeds_for_confirmed_session_and_is_single_use(self):
        user = make_user(email='tg-quick@example.test', role=UserRole.CUSTOMER)
        session = TelegramAuthSession.objects.create(
            session_id='tgs-confirmed', code='654321', status='CONFIRMED', user=user,
            confirmed_at=timezone.now(), expires_at=timezone.now() + timezone.timedelta(minutes=5),
        )
        response = self.client.post('/api/auth/telegram-quick-login', {
            'sessionId': session.session_id, 'code': session.code,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['email'], user.email)

        # Session is consumed: a second attempt with the same id/code must fail.
        replay = self.client.post('/api/auth/telegram-quick-login', {
            'sessionId': session.session_id, 'code': session.code,
        }, format='json')
        self.assertEqual(replay.status_code, 400)


class RoleEscalationTests(BaseAPITestCase):
    def test_non_founder_admin_cannot_grant_founder_role(self):
        actor = make_user(role=UserRole.ADMIN, email='admin-actor@example.test')
        target = make_user(role=UserRole.CUSTOMER, email='target1@example.test')
        login_as(self.client, actor)
        response = self.client.post(f'/api/admin/users/{target.id}/status', {'role': UserRole.FOUNDER}, format='json')
        self.assertEqual(response.status_code, 403)
        target.refresh_from_db()
        self.assertEqual(target.role, UserRole.CUSTOMER)

    def test_non_founder_admin_cannot_grant_admin_role(self):
        actor = make_user(role=UserRole.ADMIN, email='admin-actor2@example.test')
        target = make_user(role=UserRole.CUSTOMER, email='target2@example.test')
        login_as(self.client, actor)
        response = self.client.post(f'/api/admin/users/{target.id}/status', {'role': UserRole.ADMIN}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_user_cannot_change_own_role_even_as_founder(self):
        founder = make_user(role=UserRole.FOUNDER, email='self-founder@example.test')
        login_as(self.client, founder)
        response = self.client.post(f'/api/admin/users/{founder.id}/status', {'role': UserRole.ADMIN}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_user_cannot_suspend_own_status(self):
        admin = make_user(role=UserRole.ADMIN, email='self-admin@example.test')
        login_as(self.client, admin)
        response = self.client.post(f'/api/admin/users/{admin.id}/status', {'status': 'SUSPENDED'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_founder_can_grant_admin_role(self):
        founder = make_user(role=UserRole.FOUNDER, email='real-founder@example.test')
        target = make_user(role=UserRole.CUSTOMER, email='target3@example.test')
        login_as(self.client, founder)
        response = self.client.post(f'/api/admin/users/{target.id}/status', {'role': UserRole.ADMIN}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        target.refresh_from_db()
        self.assertEqual(target.role, UserRole.ADMIN)

    def test_non_admin_cannot_reach_admin_users_endpoint(self):
        customer = make_user(role=UserRole.CUSTOMER, email='plain-customer@example.test')
        login_as(self.client, customer)
        response = self.client.get('/api/admin/users')
        self.assertEqual(response.status_code, 403)


class ThrottlingTests(BaseAPITestCase):
    def test_login_endpoint_throttles_past_scope_limit(self):
        from rest_framework.throttling import ScopedRateThrottle

        rates = ScopedRateThrottle.THROTTLE_RATES
        original = rates.get('auth')
        rates['auth'] = '2/min'
        try:
            last_status = None
            for _ in range(4):
                last_status = self.client.post(
                    '/api/auth/login', {'email': 'nobody@example.test', 'password': 'wrong'}, format='json'
                ).status_code
            self.assertEqual(last_status, 429)
        finally:
            if original is None:
                rates.pop('auth', None)
            else:
                rates['auth'] = original
