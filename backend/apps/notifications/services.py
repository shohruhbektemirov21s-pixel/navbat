"""Telegram Bot API client + in-app notification helpers.

All user/business supplied text interpolated into Telegram HTML messages must be
passed through `esc()` (html.escape) to prevent markup injection.
"""
import html
import logging

import requests
from django.conf import settings

from .models import Notification, TelegramLog

logger = logging.getLogger('apps.notifications')

TELEGRAM_API = 'https://api.telegram.org/bot{token}/{method}'
REQUEST_TIMEOUT = 8


def esc(value):
    """HTML-escape any value for safe interpolation into Telegram HTML messages."""
    return html.escape('' if value is None else str(value), quote=False)


def bot_username():
    return settings.TELEGRAM_BOT_USERNAME


def bot_configured():
    return bool(settings.TELEGRAM_BOT_TOKEN)


def telegram_api(method, payload=None, timeout=REQUEST_TIMEOUT):
    """Call a Telegram Bot API method. Returns the decoded `result` or None on failure."""
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        return None
    try:
        response = requests.post(TELEGRAM_API.format(token=token, method=method), json=payload or {}, timeout=timeout)
        data = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning('telegram_api_error method=%s err=%s', method, exc.__class__.__name__)
        return None
    if not data.get('ok'):
        logger.warning('telegram_api_not_ok method=%s description=%s', method, data.get('description'))
        return None
    return data.get('result')


def send_telegram_message(chat_id, text, reply_markup=None):
    """Send an HTML message. Returns True on success. Every attempt is logged in TelegramLog."""
    if not chat_id:
        return False
    if not bot_configured():
        TelegramLog.objects.create(chat_id=str(chat_id), message=text[:500], status='NOT_CONFIGURED')
        return False
    payload = {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML', 'disable_web_page_preview': True}
    if reply_markup:
        payload['reply_markup'] = reply_markup
    result = telegram_api('sendMessage', payload)
    TelegramLog.objects.create(chat_id=str(chat_id), message=text[:500], status='SENT' if result else 'FAILED')
    return bool(result)


def notify_user(user, title, message, notif_type='INFO'):
    """Create an in-app notification (never raises)."""
    if not user:
        return None
    try:
        return Notification.objects.create(user=user, title=title[:255], message=message, type=notif_type[:32])
    except Exception:  # pragma: no cover - defensive
        logger.exception('notification_create_failed user=%s', getattr(user, 'id', None))
        return None


def business_chat_id(business):
    """Where business alerts go: the business group/channel, else the owner's private chat."""
    return business.telegram_channel_or_group or business.telegram_chat_id or (business.owner.telegram_chat_id or '')


def app_button(text='📱 NavbatBor ilovasini ochish', path=''):
    url = f'{settings.FRONTEND_URL}{path}'
    # Telegram rejects non-https (e.g. localhost) button URLs, which would fail the whole message.
    if url.startswith('https://'):
        return {'text': text, 'web_app': {'url': url}}
    return None


def inline_keyboard(*rows):
    cleaned = [[btn for btn in row if btn] for row in rows]
    cleaned = [row for row in cleaned if row]
    return {'inline_keyboard': cleaned} if cleaned else None
