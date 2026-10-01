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
        parser.add_argument('--once', action='store_true', help='Bitta getUpdates partiyasini qayta ishlab chiqish.')

    def handle(self, *args, **options):
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            raise CommandError('TELEGRAM_BOT_TOKEN o‘rnatilmagan (.env).')

        me = telegram_api('getMe')
        if not me:
            raise CommandError('Bot tokeni yaroqsiz yoki Telegram API ga ulanib bo‘lmadi.')
        telegram_api('deleteWebhook', {'drop_pending_updates': False})
        self.stdout.write(self.style.SUCCESS(f"@{me.get('username')} ishga tushdi (long polling). To‘xtatish: Ctrl+C"))

        offset = int(AppSetting.objects.filter(key=OFFSET_KEY).values_list('value', flat=True).first() or 0)
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
                    handle_update(update)
                    offset = update['update_id'] + 1
                    AppSetting.objects.update_or_create(key=OFFSET_KEY, defaults={'value': str(offset)})
                if options['once']:
                    break
        except KeyboardInterrupt:
            self.stdout.write('To‘xtatildi.')
