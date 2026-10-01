import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status, views
from rest_framework.response import Response

from apps.authentication.models import TelegramLinkToken
from apps.authentication.permissions import IsFounderOrAdmin
from apps.bookings.models import Booking
from apps.core.models import log_audit
from apps.core.utils import client_ip
from apps.marketplace.services import can_manage_business
from apps.queues.models import QueueEntry

from .bot import handle_update
from .models import Notification, TelegramLog
from .serializers import NotificationSerializer, TelegramLogSerializer
from .services import bot_configured, bot_username, esc, send_telegram_message

logger = logging.getLogger('apps.notifications')


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


NOT_LINKED_MSG = 'Telegram hisobingiz ulanmagan. Profilingizda «Telegram botni ulash» tugmasini bosing.'


class NotificationsListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifs = Notification.objects.filter(user=request.user).order_by('-created_at')[:30]
        return Response(NotificationSerializer(notifs, many=True).data)


class NotificationMarkReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        Notification.objects.filter(id=pk, user=request.user).update(is_read=True)
        return Response({'success': True})


class NotificationReadAllView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'success': True})


class TelegramBotInfoView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        username = bot_username()
        return Response({'botUsername': username, 'isConfigured': bot_configured(), 'botUrl': f'https://t.me/{username}'})


class GenerateTelegramLinkTokenView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = secrets.token_urlsafe(16).replace('-', 'x')
        TelegramLinkToken.objects.create(token=token, user=request.user, expires_at=timezone.now() + timedelta(minutes=15))
        username = bot_username()
        return Response({'linkToken': token, 'deepLink': f'https://t.me/{username}?start=link_{token}', 'botUsername': username})


class BusinessConnectLinkView(views.APIView):
    """POST /api/telegram/business-connect-link — deep link that starts the `/start bizapp`
    business-application conversation. Anonymous callers get a plain `bizapp` payload; a
    logged-in caller gets `bizapp_u<id>` so the bot can attach the application to their account."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = bot_username()
        if not username:
            return error('Telegram bot sozlanmagan.', status.HTTP_503_SERVICE_UNAVAILABLE)
        payload = f'bizapp_u{request.user.id}' if request.user.is_authenticated else 'bizapp'
        return Response({'botUsername': username, 'deepLink': f'https://t.me/{username}?start={payload}'})


def owned_chat_ids(user):
    """Chats the user may message through the bot: their own chat and their businesses' chats."""
    chats = {user.telegram_chat_id} if user.telegram_chat_id else set()
    for chat_id, group in user.owned_businesses.values_list('telegram_chat_id', 'telegram_channel_or_group'):
        chats.update(c for c in (chat_id, group) if c)
    return chats


class SendTestTelegramView(views.APIView):
    """Send a test message to the caller's own chat (or one of their businesses' chats)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        allowed = owned_chat_ids(request.user)
        chat_id = str(request.data.get('chat_id') or request.user.telegram_chat_id or '').strip()
        if not chat_id:
            return error(NOT_LINKED_MSG)
        if chat_id not in allowed:
            return error('Faqat o‘zingizga tegishli Telegram chatga test xabar yuborish mumkin.', status.HTTP_403_FORBIDDEN)
        custom = str(request.data.get('message') or '').strip()
        text = '🔔 <b>NavbatBor: sinov xabari</b>\n' + (esc(custom[:1000]) if custom else 'Telegram bildirishnomalari ishlamoqda!')
        success = send_telegram_message(chat_id, text)
        return Response({'success': success, 'message': 'Xabar yuborildi' if success else 'Yuborishda xatolik yuz berdi'})


def _target_chat(request, owner_user, business, fallback_chat=''):
    """Customers get their own chat; business managers send to the customer's linked chat."""
    user = request.user
    if owner_user is not None and owner_user.id == user.id:
        return user.telegram_chat_id or fallback_chat or ''
    if can_manage_business(user, business):
        if fallback_chat:
            return fallback_chat
        return (owner_user.telegram_chat_id or '') if owner_user else ''
    return None


class SendQueueTicketToTelegramView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, entry_id):
        entry = QueueEntry.objects.select_related('business', 'customer').filter(id=entry_id).first()
        if not entry:
            return error('Navbat topilmadi.', status.HTTP_404_NOT_FOUND)
        chat_id = _target_chat(request, entry.customer, entry.business, entry.telegram_chat_id)
        if chat_id is None:
            return error('Ruxsat berilmagan.', status.HTTP_403_FORBIDDEN)
        if not chat_id:
            return error(NOT_LINKED_MSG)
        success = send_telegram_message(chat_id, (
            '🎫 <b>NavbatBor elektron chiptasi</b>\n\n'
            f'🏢 <b>Tashkilot:</b> {esc(entry.business.name)}\n'
            f'🔢 <b>Navbat raqamingiz:</b> <code>#{esc(entry.queue_number)}</code>\n'
            f'⏳ <b>Taxminiy kutish:</b> {entry.estimated_wait_minutes} daqiqa\n\nIltimos, navbatingiz chaqirilishini kuting!'
        ))
        if not success:
            return error('Telegram xabarini yuborib bo‘lmadi.', status.HTTP_502_BAD_GATEWAY)
        return Response({'success': True, 'message': 'Chipta Telegramga yuborildi!'})


class SendBookingVoucherToTelegramView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id):
        b = Booking.objects.select_related('business', 'customer', 'staff').filter(id=booking_id).first()
        if not b:
            return error('Buyurtma topilmadi.', status.HTTP_404_NOT_FOUND)
        chat_id = _target_chat(request, b.customer, b.business)
        if chat_id is None:
            return error('Ruxsat berilmagan.', status.HTTP_403_FORBIDDEN)
        if not chat_id:
            return error(NOT_LINKED_MSG)
        success = send_telegram_message(chat_id, (
            '📅 <b>NavbatBor bron chiptasi</b>\n\n'
            f'🏢 <b>Tashkilot:</b> {esc(b.business.name)}\n'
            f'🔢 <b>Bron raqami:</b> <code>#{esc(b.booking_number)}</code>\n'
            f'🗓 <b>Sana:</b> {b.booking_date} {esc(b.start_time)}\n'
            f'👤 <b>Mutaxassis:</b> {esc(b.staff.name if b.staff else "Tanlanmagan")}\n'
            f'💰 <b>Narxi:</b> {b.total_price_uzs:,} so‘m'
        ))
        if not success:
            return error('Telegram xabarini yuborib bo‘lmadi.', status.HTTP_502_BAD_GATEWAY)
        return Response({'success': True, 'message': 'Vaucher Telegramga yuborildi!'})


class AdminTelegramLogsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        return Response(TelegramLogSerializer(TelegramLog.objects.order_by('-created_at')[:100], many=True).data)


class AdminSendTelegramView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request):
        chat_id = str(request.data.get('chat_id') or '').strip()
        message = str(request.data.get('message') or '').strip()
        if not chat_id or not message:
            return error('Chat ID va xabar matni kiritilishi shart.')
        success = send_telegram_message(chat_id, esc(message[:4000]))
        log_audit(request.user, 'ADMIN_TELEGRAM_SENT', 'TELEGRAM', chat_id, message[:200], client_ip(request))
        return Response({'success': success, 'message': 'Xabar yuborildi' if success else 'Yuborishda xatolik yuz berdi'})


class TelegramWebhookView(views.APIView):
    """POST /api/telegram/webhook/<secret> — Telegram pushes updates here (alternative to polling)."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def post(self, request, secret):
        expected = settings.TELEGRAM_WEBHOOK_SECRET
        if not expected or not hmac.compare_digest(str(secret), expected):
            return error('Topilmadi.', status.HTTP_404_NOT_FOUND)
        header = request.META.get('HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN')
        if header is not None and not hmac.compare_digest(header, expected):
            return error('Ruxsat berilmagan.', status.HTTP_403_FORBIDDEN)
        update = request.data if isinstance(request.data, dict) else {}
        if update:
            handle_update(dict(update))
        return Response({'ok': True})
