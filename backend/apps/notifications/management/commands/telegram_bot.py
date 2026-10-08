"""Run the NavbatBor Telegram bot with long polling (getUpdates).

    python manage.py telegram_bot            # run forever
    python manage.py telegram_bot --once     # process one batch and exit

Use this OR the webhook endpoint (/api/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET>),
not both: Telegram refuses getUpdates while a webhook is set, so this command
removes any webhook on start.
"""
import logging
import time

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import AppSetting
from apps.notifications.bot import handle_update
from apps.notifications.services import TELEGRAM_API, telegram_api

logger = logging.getLogger('apps.notifications.bot')

OFFSET_KEY = 'telegram_update_offset'
POLL_TIMEOUT = 25


class Command(BaseCommand):
    help = 'Telegram botini long polling rejimida ishga tushiradi.'

    def add_arguments(self, parser):
        parser.add_argument('--admin', action='store_true', help='Faqat sayt egasi uchun yopiq admin bot.')
        parser.add_argument('--once', action='store_true', help='Bitta getUpdates partiyasini qayta ishlab chiqish.')

    def handle(self, *args, **options):
        is_admin = options['admin']
        token = settings.TELEGRAM_ADMIN_BOT_TOKEN if is_admin else settings.TELEGRAM_BOT_TOKEN
        if is_admin and not settings.TELEGRAM_ADMIN_USER_IDS:
            raise CommandError('TELEGRAM_ADMIN_USER_IDS sozlanmagan. Admin bot yopiq qoladi.')
        if is_admin and any(not user_id.isdecimal() or int(user_id) <= 0 for user_id in settings.TELEGRAM_ADMIN_USER_IDS):
            raise CommandError('TELEGRAM_ADMIN_USER_IDS musbat raqamli Telegram user ID laridan iborat bo‘lishi kerak.')
        if settings.TELEGRAM_ADMIN_BOT_TOKEN and settings.TELEGRAM_ADMIN_BOT_TOKEN == settings.TELEGRAM_BOT_TOKEN:
            raise CommandError('Ochiq biznes bot va yopiq admin bot tokenlari alohida bo‘lishi kerak.')
        if is_admin:
            from apps.notifications.admin_bot import handle_update as process_update
        else:
            process_update = handle_update
        if not token:
            raise CommandError('TELEGRAM_BOT_TOKEN o‘rnatilmagan (.env).')

        me = telegram_api('getMe', token=token)
        if not me:
            raise CommandError('Bot tokeni yaroqsiz yoki Telegram API ga ulanib bo‘lmadi.')
        telegram_api('deleteWebhook', {'drop_pending_updates': False}, token=token)
        if is_admin:
            telegram_api('setChatMenuButton', {'menu_button': {'type': 'commands'}}, token=token)
            telegram_api('deleteMyCommands', token=token)
            for user_id in settings.TELEGRAM_ADMIN_USER_IDS:
                telegram_api('setMyCommands', {'scope': {'type': 'chat', 'chat_id': int(user_id)},
                            'commands': [{'command': 'arizalar', 'description': 'Biznes arizalarini ko‘rish'},
                                         {'command': 'bekor', 'description': 'Rad etishni bekor qilish'}]}, token=token)
        else:
            telegram_api('setChatMenuButton', {'menu_button': {'type': 'commands'}}, token=token)
            telegram_api('setMyCommands', {'commands': [
                {'command': 'start', 'description': 'Asosiy menyu'},
                {'command': 'biznes', 'description': 'Biznesni ro‘yxatdan o‘tkazish'},
                {'command': 'arizam', 'description': 'Ariza holatini ko‘rish'},
                {'command': 'yordam', 'description': 'Yordam va davom ettirish'},
                {'command': 'bekor_qilish', 'description': 'Qoralama arizani bekor qilish'},
            ]}, token=token)
        self.stdout.write(self.style.SUCCESS(f"@{me.get('username')} ishga tushdi (long polling). To‘xtatish: Ctrl+C"))

        offset_key = 'telegram_admin_update_offset' if is_admin else OFFSET_KEY
        offset = int(AppSetting.objects.filter(key=offset_key).values_list('value', flat=True).first() or 0)
        session = requests.Session()
        url = TELEGRAM_API.format(token=token, method='getUpdates')
        backoff = 1
        try:
            while True:
                try:
                    response = session.post(url, json={
                        'offset': offset, 'timeout': 0 if options['once'] else POLL_TIMEOUT,
                        'allowed_updates': ['message', 'callback_query'],
                    }, timeout=POLL_TIMEOUT + 10)
                    data = response.json()
                except (requests.RequestException, ValueError) as exc:
                    logger.warning('getUpdates_failed err=%s retry_in=%ss', exc.__class__.__name__, backoff)
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 60)
                    continue
                backoff = 1
                if not data.get('ok'):
                    logger.error('getUpdates_not_ok description=%s', data.get('description'))
                    time.sleep(5)
                    continue
                for update in data.get('result', []):
                    try:
                        process_update(update)
                    except Exception:
                        logger.exception('update_failed update_id=%s', update.get('update_id'))
                        break  # Retry failed update instead of acknowledging it.
                    offset = update['update_id'] + 1
                    AppSetting.objects.update_or_create(key=offset_key, defaults={'value': str(offset)})
                if options['once']:
                    break
        except KeyboardInterrupt:
            self.stdout.write('To‘xtatildi.')
