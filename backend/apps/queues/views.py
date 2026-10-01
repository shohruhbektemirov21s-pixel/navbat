from django.conf import settings
from django.db.models import Avg, Case, IntegerField, Q, Value, When
from django.utils import timezone
from rest_framework import permissions, status, views
from rest_framework.response import Response

from apps.authentication.permissions import IsFounderOrAdmin
from apps.core.utils import parse_pagination
from apps.marketplace.models import Business, BusinessStatus
from apps.marketplace.serializers import BusinessListSerializer, ServiceSerializer
from apps.marketplace.services import get_user_business

from . import services as queue_services
from .models import ACTIVE_QUEUE_STATUSES, PendingActionStatus, PendingQueueAction, QueueAuditLog, QueueEntry, QueueStatus
from .serializers import (
    ENTRY_RELATED, PublicQueueSerializer, QueueAuditLogSerializer, serialize_entries, serialize_entry,
)


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def entries_qs():
    return QueueEntry.objects.select_related(*ENTRY_RELATED)


def business_from_request(request, source='query'):
    data = request.query_params if source == 'query' else request.data
    business_id = data.get('business_id') or data.get('businessId')
    return get_user_business(request.user, business_id or None)


def entry_for_operator(request, entry_id):
    entry = entries_qs().filter(id=entry_id or '').first()
    if not entry:
        return None, error('Navbat topilmadi.', status.HTTP_404_NOT_FOUND)
    get_user_business(request.user, entry.business_id)  # raises 403 if not the caller's business
    return entry, None


def pending_payload(action):
    if not action:
        return None
    return {
        'id': action.id,
        'pendingActionId': action.id,
        'status': action.status,
        'source': action.source,
        'expires_at': action.expires_at.isoformat(),
        'targetCustomer': serialize_entry(action.called_entry),
        'currentCustomer': serialize_entry(action.current_entry),
    }


def queue_state(business):
    current = queue_services.current_entry(business)
    waiting = queue_services.waiting_qs(business)
    return {
        'currentCustomer': serialize_entry(current),
        'nextCustomer': serialize_entry(waiting.select_related(*ENTRY_RELATED).first()),
        'waitingCount': waiting.count(),
        'servedToday': queue_services.today_entries(business).filter(status=QueueStatus.COMPLETED).count(),
        'pendingAction': pending_payload(queue_services.active_pending(business)),
    }


def telegram_ticket_link(entry):
    return f'https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start=queue_{entry.id}'


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------
class JoinQueueView(views.APIView):
    """Join a business's live queue (guests allowed with a name; logged-in users are linked)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        biz = Business.objects.filter(id=data.get('business_id') or '').first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        from apps.authentication.views import clean_chat_id
        entry = queue_services.join_queue(
            business=biz,
            customer=request.user if request.user.is_authenticated else None,
            customer_name=str(data.get('customer_name') or ''),
            customer_phone=str(data.get('customer_phone') or ''),
            service_id=data.get('service_id'),
            staff_id=data.get('staff_id'),
            telegram_chat_id=clean_chat_id(data.get('telegram_chat_id')),
        )
        payload = serialize_entry(entries_qs().get(pk=entry.pk))
        return Response({**payload, 'telegramLink': telegram_ticket_link(entry)}, status=status.HTTP_201_CREATED)


class InstantQueueCheckInView(JoinQueueView):
    pass


class MyActiveQueueView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.core.utils import local_today
        entry = entries_qs().filter(
            customer=request.user, queue_date=local_today(), status__in=ACTIVE_QUEUE_STATUSES
        ).order_by('-created_at').first()
        return Response({'activeQueue': serialize_entry(entry)})


# ---------------------------------------------------------------------------
# Business / operator
# ---------------------------------------------------------------------------
class BusinessQueueView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, business_id):
        biz = get_user_business(request.user, business_id)
        order = Case(
            When(status=QueueStatus.SERVING, then=Value(1)), When(status=QueueStatus.CALLED, then=Value(2)),
            When(status=QueueStatus.WAITING, then=Value(3)), When(status=QueueStatus.COMPLETED, then=Value(4)),
            default=Value(5), output_field=IntegerField(),
        )
        entries = entries_qs().filter(business=biz, queue_date=queue_services.local_today()).order_by(order, 'created_at')
        return Response(serialize_entries(entries))


class CurrentQueueStateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.query_params.get('business_id') or request.query_params.get('businessId')):
            return error('business_id kiritilishi shart.')
        return Response(queue_state(business_from_request(request)))


class WaitingQueueListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.query_params.get('business_id') or request.query_params.get('businessId')):
            return error('business_id kiritilishi shart.')
        biz = business_from_request(request)
        waiting = queue_services.waiting_qs(biz).select_related(*ENTRY_RELATED)
        data = serialize_entries(waiting)
        return Response({'waitingCustomers': data, 'count': len(data)})


class OperatorCallNextView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = business_from_request(request, 'body')
        called, previous = queue_services.call_next(biz, request.user)
        if not called:
            return Response({
                'success': False,
                'message': 'Kutayotgan mijozlar qolmadi.',
                'calledCustomer': None,
                'previousCustomer': serialize_entry(previous),
            })
        return Response({
            'success': True,
            'message': f'Mijoz {called.queue_number} chaqirildi!',
            'calledCustomer': serialize_entry(called),
            'previousCustomer': serialize_entry(previous),
        })


class OperatorAcceptView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        entry, err = entry_for_operator(request, request.data.get('entry_id'))
        if err:
            return err
        queue_services.apply_action(entry, 'SERVE', request.user)
        return Response({'success': True, 'status': QueueStatus.SERVING,
                         'message': f'Mijoz {entry.queue_number} xizmatga qabul qilindi.'})


class OperatorCancelView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        entry, err = entry_for_operator(request, request.data.get('entry_id'))
        if err:
            return err
        queue_services.apply_action(entry, 'SKIP', request.user)
        return Response({'success': True, 'status': QueueStatus.SKIPPED,
                         'message': f'Mijoz {entry.queue_number} o‘tkazib yuborildi.'})


class CompleteQueueServiceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        entry_id = request.data.get('entry_id')
        if entry_id:
            entry, err = entry_for_operator(request, entry_id)
            if err:
                return err
        else:
            biz = business_from_request(request, 'body')
            entry = queue_services.current_entry(biz)
            if not entry:
                return error('Hozir xizmat ko‘rsatilayotgan mijoz yo‘q.')
        queue_services.apply_action(entry, 'COMPLETE', request.user)
        return Response({'success': True, 'message': 'Xizmat muvaffaqiyatli yakunlandi.',
                         'completedCustomer': serialize_entry(entry)})


class NoShowQueueCustomerView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        entry, err = entry_for_operator(request, request.data.get('entry_id'))
        if err:
            return err
        queue_services.apply_action(entry, 'NO_SHOW', request.user)
        return Response({'success': True, 'message': 'Mijoz kelmadi deb belgilandi.'})


class QueueEntryActionView(views.APIView):
    """POST /business/queue/<id>/action {action: CALL|SERVE|COMPLETE|SKIP|NO_SHOW}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, entry_id):
        entry, err = entry_for_operator(request, entry_id)
        if err:
            return err
        queue_services.apply_action(entry, request.data.get('action'), request.user)
        return Response({'success': True, 'status': entry.status, 'entry': serialize_entry(entry)})


class QueueNextRequestView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        biz = business_from_request(request, 'body')
        action, telegram_sent = queue_services.request_next(biz, request.user)
        payload = pending_payload(action)
        return Response({
            'success': True,
            'pendingActionId': action.id,
            'pendingAction': payload,
            'waitingTelegramConfirmation': telegram_sent,
            'message': ('Telegram orqali tasdiqlash so‘rovi yuborildi.' if telegram_sent
                        else 'Keyingi mijozni chaqirish tasdiqlanishi kutilmoqda.'),
            'nextCustomer': payload['targetCustomer'],
            'currentCustomer': payload['currentCustomer'],
        })


def load_pending(request, action_id):
    action = PendingQueueAction.objects.select_related('business', 'called_entry', 'current_entry').filter(
        id=action_id or '').first()
    if not action:
        return None, error('Amal topilmadi.', status.HTTP_404_NOT_FOUND)
    get_user_business(request.user, action.business_id)
    return action, None


class QueueNextConfirmView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        action_id = request.data.get('pending_action_id')
        if action_id:
            action, err = load_pending(request, action_id)
            if err:
                return err
            called, previous = queue_services.confirm_pending(action, request.user)
        else:
            biz = business_from_request(request, 'body')
            if not queue_services.waiting_qs(biz).exists():
                return error('Navbatda kutayotgan mijoz mavjud emas.')
            called, previous = queue_services.call_next(biz, request.user)
        if not called:
            return error('Navbatda kutayotgan mijoz mavjud emas.')
        return Response({
            'success': True,
            'message': f'Mijoz {called.queue_number} chaqirildi!',
            'calledCustomer': serialize_entry(called),
            'previousCustomer': serialize_entry(previous),
        })


class QueuePendingCancelView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        action_id = request.data.get('pending_action_id')
        if not action_id:
            return error('pending_action_id kiritilmadi.')
        action, err = load_pending(request, action_id)
        if err:
            return err
        queue_services.cancel_pending(action, request.user)
        return Response({'success': True, 'message': 'Amal bekor qilindi'})


class QueuePendingStatusView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, action_id):
        action, err = load_pending(request, action_id)
        if err:
            return err
        if action.is_expired:
            PendingQueueAction.objects.filter(pk=action.pk).update(status=PendingActionStatus.EXPIRED)
            action.status = PendingActionStatus.EXPIRED
        return Response({
            'status': action.status,
            'confirmed_at': action.confirmed_at.isoformat() if action.confirmed_at else None,
            'expires_at': action.expires_at.isoformat(),
            'calledCustomer': serialize_entry(action.called_entry) if action.status == PendingActionStatus.CONFIRMED else None,
        })


class QueueAuditLogsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, business_id):
        biz = get_user_business(request.user, business_id)
        logs = QueueAuditLog.objects.filter(business=biz).select_related('actor', 'entry').order_by('-created_at')[:100]
        return Response(QueueAuditLogSerializer(logs, many=True).data)


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------
class PublicQueueBoardView(views.APIView):
    """TV board. Never exposes phones or full names (PublicQueueSerializer)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        biz = Business.objects.filter(Q(slug=slug) | Q(id=slug), status=BusinessStatus.APPROVED).first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        today = queue_services.today_entries(biz).select_related('service')
        serving = list(today.filter(status=QueueStatus.SERVING).order_by('called_at'))
        called = list(today.filter(status=QueueStatus.CALLED).order_by('-called_at')[:5])
        waiting_qs = today.filter(status=QueueStatus.WAITING).order_by('created_at')
        waiting = list(waiting_qs[:15])
        waiting_count = waiting_qs.count()
        now = timezone.now().isoformat()
        serving_data = PublicQueueSerializer(serving, many=True).data
        called_data = PublicQueueSerializer(called, many=True).data
        waiting_data = PublicQueueSerializer(waiting, many=True).data
        return Response({
            'business': {'id': biz.id, 'name': biz.name, 'slug': biz.slug, 'logo_url': biz.logo_url,
                         'district': biz.district, 'address': biz.address, 'phone': biz.phone},
            'serving': serving_data,
            'called': called_data,
            'waiting': waiting_data,
            'totalWaiting': waiting_count,
            'lastUpdated': now,
            # Legacy keys kept for older clients.
            'currentServing': serving_data[0] if serving_data else None,
            'calledList': called_data,
            'waitingList': waiting_data,
            'waitingCount': waiting_count,
            'serverTime': now,
        })


class ResolveQRCodeView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from apps.marketplace.serializers import with_business_stats

        code = str(request.data.get('code') or '').strip()
        if not code:
            return error('QR kod bo‘sh.')
        ref = code.rstrip('/').split('/')[-1].split('?')[0]
        biz = with_business_stats(Business.objects.filter(Q(id=ref) | Q(slug=ref), status=BusinessStatus.APPROVED)).first()
        if not biz:
            return Response({'type': 'unknown', 'error': 'QR kod aniqlanmadi', 'message': 'QR kod aniqlanmadi'}, status=404)
        waiting_cnt = queue_services.waiting_qs(biz).count()
        services = biz.services.filter(is_active=True).order_by('price_uzs')
        avg_duration = int(services.aggregate(a=Avg('duration_minutes'))['a'] or queue_services.DEFAULT_SERVICE_MINUTES)
        return Response({
            'type': 'business',
            'business': BusinessListSerializer(biz).data,
            'liveQueue': {
                'activeCount': waiting_cnt,
                'estimatedWaitMinutes': waiting_cnt * avg_duration,
                'avgDurationMinutes': avg_duration,
            },
            'services': ServiceSerializer(services, many=True).data,
        })


class AdminQueuesListView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        page, limit = parse_pagination(request.query_params, default_limit=100, max_limit=100)
        offset = (page - 1) * limit
        entries = entries_qs().order_by('-created_at')[offset:offset + limit]
        return Response(serialize_entries(entries))
