import uuid
from datetime import timedelta
import requests
from django.utils import timezone
from django.conf import settings
from rest_framework import views, permissions, status
from rest_framework.response import Response

from .models import Notification, TelegramLog
from .serializers import NotificationSerializer, TelegramLogSerializer
from apps.authentication.models import TelegramLinkToken
from apps.authentication.permissions import IsFounderOrAdmin
from apps.bookings.models import Booking
from apps.queues.models import QueueEntry


def send_telegram_message(chat_id, text):
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        r = requests.post(url, json={'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}, timeout=5)
        TelegramLog.objects.create(
            chat_id=str(chat_id),
            message=text[:500],
            status='SENT' if r.status_code == 200 else 'FAILED'
        )
        return r.status_code == 200
    except Exception as e:
        TelegramLog.objects.create(
            chat_id=str(chat_id),
            message=f"{text[:400]} (Error: {str(e)})",
            status='ERROR'
        )
        return False


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
        bot_username = "NavbatBor_bot"
        return Response({
            'botUsername': bot_username,
            'isConfigured': bool(settings.TELEGRAM_BOT_TOKEN),
            'botUrl': f"https://t.me/{bot_username}"
        })


class GenerateTelegramLinkTokenView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = uuid.uuid4().hex[:16]
        TelegramLinkToken.objects.create(
            token=token,
            user=request.user,
            expires_at=timezone.now() + timedelta(minutes=15)
        )
        bot_username = "NavbatBor_bot"
        return Response({
            'linkToken': token,
            'deepLink': f"https://t.me/{bot_username}?start=link_{token}",
            'botUsername': bot_username
        })


class SendTestTelegramView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        chat_id = request.data.get('chat_id')
        msg = request.data.get('message', '🔔 NavbatBor tizimidan test xabari!')
        success = send_telegram_message(chat_id, msg)
        return Response({'success': success, 'message': 'Xabar yuborildi' if success else 'Yuborishda xatolik yuz berdi'})


class SendQueueTicketToTelegramView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, entry_id):
        entry = QueueEntry.objects.filter(id=entry_id).first()
        if not entry:
            return Response({'error': 'Navbat topilmadi'}, status=404)

        chat_id = request.data.get('chat_id') or (entry.customer.telegram_chat_id if entry.customer else None)
        text = f"🎫 <b>NavbatBor Elektron Chiptasi</b>\n\n🏢 <b>Tashkilot:</b> {entry.business.name}\n🔢 <b>Navbat raqamingiz:</b> <code>#{entry.queue_number}</code>\n⏳ <b>Taxminiy kutish:</b> {entry.estimated_wait_minutes} daqiqa\n\nIltimos, navbatingiz chaqirilishini kuting!"
        success = send_telegram_message(chat_id, text)
        return Response({'success': True, 'message': 'Chipta Telegramga yuborildi!'})


class SendBookingVoucherToTelegramView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, booking_id):
        b = Booking.objects.filter(id=booking_id).first()
        if not b:
            return Response({'error': 'Buyurtma topilmadi'}, status=404)

        chat_id = request.data.get('chat_id') or (b.customer.telegram_chat_id if b.customer else None)
        text = f"📅 <b>NavbatBor Bron Chiptasi</b>\n\n🏢 <b>Tashkilot:</b> {b.business.name}\n🔢 <b>Bron raqami:</b> <code>#{b.booking_number}</code>\n🗓 <b>Sana:</b> {b.booking_date} {b.start_time}\n👤 <b>Mutaxassis:</b> {b.staff.name if b.staff else 'Tanlanmagan'}\n💰 <b>Narxi:</b> {b.total_price_uzs:,} so'm"
        success = send_telegram_message(chat_id, text)
        return Response({'success': True, 'message': 'Vaucher Telegramga yuborildi!'})


# Admin Telegram
class AdminTelegramLogsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        logs = TelegramLog.objects.all().order_by('-created_at')[:100]
        return Response(TelegramLogSerializer(logs, many=True).data)


class AdminSendTelegramView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request):
        chat_id = request.data.get('chat_id')
        msg = request.data.get('message', '')
        success = send_telegram_message(chat_id, msg)
        return Response({'success': success})
