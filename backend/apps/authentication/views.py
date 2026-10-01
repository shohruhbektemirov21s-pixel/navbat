import logging
import re
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status, views
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.exceptions import _first_message
from apps.core.models import log_audit
from apps.core.utils import client_ip

from .models import TelegramAuthSession, User, UserRole, UserStatus
from .permissions import ADMIN_ROLES, IsFounderOrAdmin
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer, run_password_validators
from .telegram import TelegramAuthError, get_or_create_telegram_user, verify_webapp_init_data

logger = logging.getLogger('apps.authentication')

CHAT_ID_RE = re.compile(r'^-?\d{3,20}$|^@[A-Za-z0-9_]{4,64}$')
SESSION_TTL = timedelta(minutes=10)


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------
def issue_tokens(user):
    """Return {'token': <access>, 'refresh': <refresh>} for `user`."""
    refresh = RefreshToken.for_user(user)
    refresh['role'] = user.role
    return {'token': str(refresh.access_token), 'refresh': str(refresh)}


def auth_payload(user, message=None, **extra):
    data = {**issue_tokens(user), 'user': UserSerializer(user).data}
    if message:
        data['message'] = message
    data.update(extra)
    return data


def revoke_user_tokens(user):
    """Blacklist every outstanding refresh token of `user` (used on suspend / password reset)."""
    for token in OutstandingToken.objects.filter(user=user, expires_at__gt=timezone.now()):
        BlacklistedToken.objects.get_or_create(token=token)


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


class AuthThrottleMixin:
    throttle_scope = 'auth'

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [*super().get_throttles(), ScopedRateThrottle()]


# ---------------------------------------------------------------------------
# Email / password
# ---------------------------------------------------------------------------
class RegisterView(AuthThrottleMixin, views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error(_first_message(serializer.errors) or "Ro'yxatdan o'tishda xatolik.")
        user = serializer.save()
        log_audit(user, 'USER_REGISTERED', 'USER', user.id, 'Mijoz o‘zi ro‘yxatdan o‘tdi', client_ip(request))
        return Response(auth_payload(user, "Ro'yxatdan muvaffaqiyatli o'tdingiz!"), status=status.HTTP_201_CREATED)


class LoginView(AuthThrottleMixin, views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return error(_first_message(serializer.errors) or 'Kirishda xatolik yuz berdi.')
        user = serializer.validated_data['user']
        return Response(auth_payload(user, 'Tizimga muvaffaqiyatli kirdingiz!'))


class RefreshTokenView(views.APIView):
    """POST {refresh} -> {token, refresh}. Refresh tokens rotate; the old one is blacklisted."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_poll'

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        raw = request.data.get('refresh')
        if not raw or not isinstance(raw, str):
            return error('Refresh token kiritilmagan.', status.HTTP_401_UNAUTHORIZED)
        try:
            user_id = RefreshToken(raw).get('user_id')
        except TokenError:
            return error('Refresh token yaroqsiz yoki muddati tugagan. Qaytadan kiring.', status.HTTP_401_UNAUTHORIZED)
        user = User.objects.filter(id=user_id).first()
        if not user or not user.is_active or user.status == UserStatus.SUSPENDED:
            return error('Hisob faol emas. Qaytadan kiring.', status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError) as exc:
            logger.info('refresh_rejected user=%s reason=%s', user_id, exc.__class__.__name__)
            return error('Refresh token yaroqsiz yoki muddati tugagan. Qaytadan kiring.', status.HTTP_401_UNAUTHORIZED)
        data = serializer.validated_data
        return Response({'token': data['access'], 'refresh': data.get('refresh', raw)})


class GetMeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'user': UserSerializer(request.user).data})


class LogoutView(views.APIView):
    """POST {refresh}: blacklists the refresh token. Idempotent; works with an expired access token."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.data.get('refresh') if hasattr(request, 'data') else None
        if raw and isinstance(raw, str):
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass  # already invalid/blacklisted: logging out is still successful
        return Response({'success': True, 'message': 'Tizimdan chiqildi'})


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------
class TelegramWebAppLoginView(AuthThrottleMixin, views.APIView):
    """Login inside the Telegram Mini App. Only the HMAC-verified initData is trusted."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            return error('Telegram bot sozlanmagan. Keyinroq urinib ko‘ring.', status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            tg_user = verify_webapp_init_data(request.data.get('initData'), token, settings.TELEGRAM_INITDATA_MAX_AGE)
            user = get_or_create_telegram_user(tg_user)
        except TelegramAuthError as exc:
            return error(str(exc), status.HTTP_401_UNAUTHORIZED)
        return Response(auth_payload(user, 'Telegram orqali muvaffaqiyatli kirildi', success=True))


class TelegramSessionCreateView(AuthThrottleMixin, views.APIView):
    """Start a browser login that the user confirms inside the Telegram bot."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        session_id = f'tgs{uuid.uuid4().hex[:20]}'
        code = f'{secrets.randbelow(900000) + 100000}'
        expires_at = timezone.now() + SESSION_TTL
        TelegramAuthSession.objects.create(session_id=session_id, code=code, expires_at=expires_at, status='PENDING')
        bot_username = settings.TELEGRAM_BOT_USERNAME
        return Response({
            'sessionId': session_id,
            'code': code,
            'botUsername': bot_username,
            'botUrl': f'https://t.me/{bot_username}',
            'deepLink': f'https://t.me/{bot_username}?start=auth_{session_id}',
            'tgDirect': f'tg://resolve?domain={bot_username}&start=auth_{session_id}',
            'expiresAt': expires_at.isoformat(),
        })


def consume_confirmed_session(session):
    """Atomically flip CONFIRMED -> CONSUMED so a confirmed session yields tokens exactly once."""
    updated = TelegramAuthSession.objects.filter(pk=session.pk, status='CONFIRMED').update(status='CONSUMED')
    return bool(updated) and session.user is not None


class TelegramSessionCheckView(views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'auth_poll'

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def get(self, request, session_id):
        session = TelegramAuthSession.objects.select_related('user').filter(session_id=session_id).first()
        if not session:
            return Response({'status': 'EXPIRED', 'error': 'Sessiya topilmadi.'}, status=404)
        if session.status == 'PENDING' and timezone.now() > session.expires_at:
            TelegramAuthSession.objects.filter(pk=session.pk).update(status='EXPIRED')
            return Response({'status': 'EXPIRED'})
        if session.status == 'CONFIRMED':
            user = session.user
            if user and user.is_active and user.status != UserStatus.SUSPENDED and consume_confirmed_session(session):
                return Response({'status': 'CONFIRMED', **auth_payload(user)})
            return Response({'status': 'EXPIRED'})
        if session.status == 'CONSUMED':
            return Response({'status': 'EXPIRED'})
        return Response({'status': session.status})


class QuickTelegramLoginView(AuthThrottleMixin, views.APIView):
    """'Check now' button for a Telegram browser session.

    Tokens are issued ONLY for a session that the Telegram bot already CONFIRMED
    (sessionId + code must match). Phone-only login exists solely for local
    development (DEBUG and ALLOW_DEV_QUICK_LOGIN=1) and only for CUSTOMER accounts.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        session_id = str(request.data.get('sessionId') or '').strip()
        code = str(request.data.get('code') or '').strip()

        if session_id or code:
            if not (session_id and code):
                return error('Sessiya ID va tasdiqlash kodi birga yuborilishi kerak.')
            session = TelegramAuthSession.objects.select_related('user').filter(session_id=session_id, code=code).first()
            if not session:
                return error('Sessiya topilmadi yoki kod noto‘g‘ri.', status.HTTP_404_NOT_FOUND)
            if session.status == 'PENDING':
                if timezone.now() > session.expires_at:
                    TelegramAuthSession.objects.filter(pk=session.pk).update(status='EXPIRED')
                    return error('Sessiya muddati tugagan. Qaytadan urinib ko‘ring.')
                return error('Kirish hali Telegram bot orqali tasdiqlanmagan. Botda «Kirish» tugmasini bosing.')
            if session.status != 'CONFIRMED':
                return error('Sessiya muddati tugagan yoki allaqachon ishlatilgan.')
            user = session.user
            if not user or not user.is_active or user.status == UserStatus.SUSPENDED:
                return error('Hisobingiz faol emas.', status.HTTP_403_FORBIDDEN)
            if not consume_confirmed_session(session):
                return error('Sessiya allaqachon ishlatilgan.')
            return Response(auth_payload(user, 'Telegram orqali tezkor kirildi', success=True))

        return self._dev_phone_login(request)

    def _dev_phone_login(self, request):
        if not settings.ALLOW_DEV_QUICK_LOGIN:
            return error('Telefon raqami orqali tezkor kirish o‘chirilgan. Telegram bot orqali kiring.',
                         status.HTTP_403_FORBIDDEN)
        phone = ''.join(c for c in str(request.data.get('phone') or '') if c.isdigit() or c == '+')
        if len(phone.lstrip('+')) < 9:
            return error('Telefon raqamini to‘g‘ri kiriting.')
        user = User.objects.filter(phone=phone).first()
        if user is None:
            user = User.objects.create_user(
                email=f'user_{uuid.uuid4().hex[:10]}@navbatbor.uz',
                name=(str(request.data.get('name') or '').strip() or 'Mijoz')[:255],
                phone=phone, role=UserRole.CUSTOMER, status=UserStatus.ACTIVE,
            )
        if user.role != UserRole.CUSTOMER:
            return error('Bu hisob uchun tezkor kirish mumkin emas. Email va parol bilan kiring.', status.HTTP_403_FORBIDDEN)
        if not user.is_active or user.status == UserStatus.SUSPENDED:
            return error('Hisobingiz faol emas.', status.HTTP_403_FORBIDDEN)
        logger.warning('dev_quick_login user=%s', user.id)
        return Response(auth_payload(user, 'Tezkor kirish (dev rejimi)', success=True))


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
def clean_chat_id(value):
    value = str(value or '').strip()
    if value and not CHAT_ID_RE.match(value):
        raise ValidationError({'error': 'Telegram chat ID noto‘g‘ri formatda (faqat raqamlar yoki @kanal).'})
    return value


class UpdateUserTelegramView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.notifications.services import esc, send_telegram_message

        chat_id = clean_chat_id(request.data.get('telegram_chat_id'))
        user = request.user
        user.telegram_chat_id = chat_id or None
        user.telegram_notifications_enabled = bool(chat_id)
        user.save(update_fields=['telegram_chat_id', 'telegram_notifications_enabled'])
        test_result = None
        if chat_id and request.data.get('send_test', True):
            test_result = send_telegram_message(chat_id, (
                f'👋 <b>Salom, {esc(user.name)}!</b>\nNavbatBor Telegram bildirishnomalari muvaffaqiyatli ulandi.'
            ))
        return Response({'success': True, 'testResult': test_result, 'message': 'Telegram sozlamalari yangilandi.'})


class CustomerProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        user = request.user
        data = request.data
        fields = []
        if 'name' in data:
            name = str(data.get('name') or '').strip()
            if not name:
                return error('Ism bo‘sh bo‘lishi mumkin emas.')
            user.name = name[:255]
            fields.append('name')
        if 'phone' in data:
            phone = str(data.get('phone') or '').strip()
            if phone and not re.match(r'^\+?[0-9 ()-]{7,20}$', phone):
                return error('Telefon raqami noto‘g‘ri formatda.')
            user.phone = phone or None
            fields.append('phone')
        if 'telegram_chat_id' in data:
            user.telegram_chat_id = clean_chat_id(data.get('telegram_chat_id')) or None
            fields.append('telegram_chat_id')
        if fields:
            user.save(update_fields=fields)
        payload = UserSerializer(user).data
        return Response({**payload, 'success': True, 'user': payload})


# ---------------------------------------------------------------------------
# Admin user management
# ---------------------------------------------------------------------------
def _guard_privileged_change(actor, target=None, new_role=None):
    """Only a FOUNDER may create/modify FOUNDER or ADMIN accounts or grant those roles."""
    privileged = set(ADMIN_ROLES)
    touches_privileged = (new_role in privileged) or (target is not None and target.role in privileged)
    if touches_privileged and actor.role != UserRole.FOUNDER:
        return error('Founder yoki Admin huquqlarini faqat Founder boshqarishi mumkin.', status.HTTP_403_FORBIDDEN)
    return None


class AdminUsersView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        users = User.objects.all().order_by('-created_at')
        return Response(UserSerializer(users, many=True).data)


class AdminCreateUserView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request):
        data = request.data
        email = str(data.get('email') or '').strip().lower()
        name = str(data.get('name') or '').strip()
        password = data.get('password') or ''
        role = data.get('role') or UserRole.CUSTOMER
        phone = str(data.get('phone') or '').strip()

        if not email or not password or not name:
            return error('Ism, email va parol kiritilishi shart.')
        if role not in UserRole.values:
            return error('Noto‘g‘ri rol.')
        denied = _guard_privileged_change(request.user, new_role=role)
        if denied:
            return denied
        if User.objects.filter(email__iexact=email).exists():
            return error('Bu email allaqachon mavjud.')
        try:
            run_password_validators(password, User(email=email, name=name))
        except ValidationError as exc:
            return error(_first_message(exc.detail))

        user = User.objects.create_user(
            email=email, password=password, name=name, role=role, phone=phone or None,
            status=UserStatus.ACTIVE, is_staff=role in ADMIN_ROLES,
        )
        log_audit(request.user, 'USER_CREATED', 'USER', user.id, f'Yangi {role} hisobi: {email}', client_ip(request),
                  target_name=name, new_value=role)
        payload = UserSerializer(user).data
        return Response({**payload, 'success': True, 'user': payload}, status=status.HTTP_201_CREATED)


class AdminResetPasswordView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, user_id):
        target = User.objects.filter(id=user_id).first()
        if not target:
            return error('Foydalanuvchi topilmadi.', status.HTTP_404_NOT_FOUND)
        denied = _guard_privileged_change(request.user, target=target) if target.id != request.user.id else None
        if denied:
            return denied
        new_password = request.data.get('password') or ''
        try:
            run_password_validators(new_password, target)
        except ValidationError as exc:
            return error(_first_message(exc.detail))
        target.set_password(new_password)
        target.save(update_fields=['password'])
        revoke_user_tokens(target)
        log_audit(request.user, 'PASSWORD_RESET', 'USER', target.id, f'Parol yangilandi: {target.email}',
                  client_ip(request), target_name=target.name)
        return Response({'success': True, 'message': 'Parol muvaffaqiyatli yangilandi.'})


class AdminUpdateUserStatusView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, user_id):
        actor = request.user
        target = User.objects.filter(id=user_id).first()
        if not target:
            return error('Foydalanuvchi topilmadi.', status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status') or None
        new_role = request.data.get('role') or None
        reason = str(request.data.get('reason') or '').strip()
        if new_status == 'BLOCKED':
            new_status = UserStatus.SUSPENDED
        if new_status and new_status not in UserStatus.values:
            return error('Noto‘g‘ri holat qiymati.')
        if new_role and new_role not in UserRole.values:
            return error('Noto‘g‘ri rol.')
        if target.id == actor.id and ((new_role and new_role != target.role) or (new_status and new_status != target.status)):
            return error('O‘z rolingiz yoki holatingizni o‘zgartira olmaysiz.', status.HTTP_403_FORBIDDEN)
        denied = _guard_privileged_change(actor, target=target, new_role=new_role)
        if denied:
            return denied

        old_role, old_status = target.role, target.status
        with transaction.atomic():
            if new_status:
                target.status = new_status
                target.is_active = new_status != UserStatus.SUSPENDED
            if new_role:
                target.role = new_role
                target.is_staff = new_role in ADMIN_ROLES
            target.save()
            if new_status == UserStatus.SUSPENDED:
                revoke_user_tokens(target)

        action = 'USER_BLOCKED' if new_status == UserStatus.SUSPENDED else (
            'USER_UNBLOCKED' if new_status == UserStatus.ACTIVE and old_status != UserStatus.ACTIVE else 'USER_ROLE_UPDATED')
        log_audit(actor, action, 'USER', target.id,
                  f'{target.name} ({target.email}) | Holat: {old_status} -> {target.status} | Rol: {old_role} -> {target.role}'
                  + (f' | Sabab: {reason}' if reason else ''), client_ip(request),
                  target_name=target.name, old_value=f'{old_role} / {old_status}', new_value=f'{target.role} / {target.status}')
        payload = UserSerializer(target).data
        return Response({**payload, 'success': True, 'user': payload})
