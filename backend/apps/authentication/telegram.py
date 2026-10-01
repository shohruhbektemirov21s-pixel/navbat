"""Telegram identity helpers: WebApp initData verification and user linking."""
import hashlib
import hmac
import json
import time
import uuid
from urllib.parse import parse_qsl

from django.conf import settings

from .models import User, UserRole, UserStatus


class TelegramAuthError(Exception):
    pass


def verify_webapp_init_data(init_data, bot_token, max_age_seconds):
    """Validate Telegram Mini App `initData` and return the verified `user` dict.

    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
    hash       = hex(HMAC_SHA256(key=secret_key, msg=data_check_string))
    """
    if not init_data or not isinstance(init_data, str):
        raise TelegramAuthError('Telegram initData topilmadi.')
    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True)
    except ValueError:
        raise TelegramAuthError('Telegram initData formati noto‘g‘ri.')
    data = dict(pairs)
    received_hash = data.pop('hash', '')
    if not received_hash:
        raise TelegramAuthError('Telegram imzosi (hash) topilmadi.')

    data_check_string = '\n'.join(f'{key}={data[key]}' for key in sorted(data))
    secret_key = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise TelegramAuthError('Telegram imzosi yaroqsiz.')

    try:
        auth_date = int(data.get('auth_date', '0'))
    except ValueError:
        raise TelegramAuthError('auth_date noto‘g‘ri.')
    now = int(time.time())
    if auth_date <= 0 or now - auth_date > max_age_seconds or auth_date - now > 300:
        raise TelegramAuthError('Telegram sessiyasi eskirgan. Mini ilovani qayta oching.')

    try:
        tg_user = json.loads(data.get('user') or '{}')
    except ValueError:
        raise TelegramAuthError('Telegram foydalanuvchi ma’lumotlari noto‘g‘ri.')
    if not isinstance(tg_user, dict) or not tg_user.get('id'):
        raise TelegramAuthError('Telegram foydalanuvchi ma’lumotlari topilmadi.')
    return tg_user


def get_or_create_telegram_user(tg_user):
    """Find the account linked to a *verified* Telegram id, or create a CUSTOMER account.

    Matching is by telegram id only (never by username/phone, which are not proofs of identity).
    Raises TelegramAuthError for suspended accounts.
    """
    chat_id = str(tg_user.get('id'))
    username = (tg_user.get('username') or '').strip()[:128]
    full_name = ' '.join(filter(None, [tg_user.get('first_name'), tg_user.get('last_name')])).strip()

    user = User.objects.filter(telegram_chat_id=chat_id).order_by('created_at').first()
    if user is None:
        email = f'tg_{chat_id}@telegram.navbatbor.uz'
        if User.objects.filter(email=email).exists():
            email = f'tg_{chat_id}_{uuid.uuid4().hex[:6]}@telegram.navbatbor.uz'
        user = User.objects.create_user(
            email=email,
            name=(full_name or (f'@{username}' if username else 'Telegram foydalanuvchisi'))[:255],
            role=UserRole.CUSTOMER,
            status=UserStatus.ACTIVE,
            telegram_chat_id=chat_id,
            telegram_username=username or None,
        )
        return user

    if not user.is_active or user.status == UserStatus.SUSPENDED:
        raise TelegramAuthError('Hisobingiz to‘xtatilgan. Administrator bilan bog‘laning.')
    if username and user.telegram_username != username:
        user.telegram_username = username
        user.save(update_fields=['telegram_username'])
    return user


def bot_token():
    return settings.TELEGRAM_BOT_TOKEN
