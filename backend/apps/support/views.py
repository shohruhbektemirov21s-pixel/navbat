from django.utils import timezone
from rest_framework import permissions, status, views
from rest_framework.response import Response

from apps.authentication.permissions import SUPPORT_STAFF_ROLES, has_role
from apps.core.models import log_audit
from apps.core.utils import client_ip
from apps.marketplace.models import Business

from .models import TICKET_PRIORITIES, TICKET_STATUSES, SupportTicket
from .serializers import SupportTicketSerializer


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def tickets_qs():
    return SupportTicket.objects.select_related('user', 'business', 'assigned_to')


def is_support_staff(user):
    return has_role(user, SUPPORT_STAFF_ROLES)


class PartnerSupportTicketsView(views.APIView):
    """Support staff (SUPPORT / OPERATING_PARTNER / ADMIN / FOUNDER) see all tickets; others only their own."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = tickets_qs().order_by('-created_at')
        if not is_support_staff(request.user):
            qs = qs.filter(user=request.user)
        return Response(SupportTicketSerializer(qs, many=True).data)

    def post(self, request):
        data = request.data
        subject = str(data.get('subject') or '').strip()
        body = str(data.get('description') or data.get('message') or '').strip()
        if not subject or not body:
            return error('Mavzu va tavsifni to‘ldiring.')
        priority = str(data.get('priority') or 'MEDIUM').upper()
        if priority not in TICKET_PRIORITIES:
            return error('Noto‘g‘ri muhimlik darajasi.')
        business = None
        if data.get('business_id'):
            business = Business.objects.filter(id=data['business_id']).first()
        ticket = SupportTicket.objects.create(
            user=request.user, business=business,
            customer_name=str(data.get('customer_name') or '')[:255], customer_phone=str(data.get('customer_phone') or '')[:32],
            subject=subject[:255], message=body[:10000], priority=priority, status='OPEN',
            assigned_to=request.user if is_support_staff(request.user) else None,
        )
        log_audit(request.user, 'SUPPORT_TICKET_CREATED', 'SUPPORT_TICKET', ticket.id, subject, client_ip(request),
                  target_name=subject)
        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class SupportTicketStatusUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        ticket = tickets_qs().filter(id=pk).first()
        if not ticket:
            return error('Murojaat topilmadi.', status.HTTP_404_NOT_FOUND)
        staff = is_support_staff(request.user)
        if not staff and ticket.user_id != request.user.id:
            return error('Murojaat topilmadi.', status.HTTP_404_NOT_FOUND)

        new_status = str(request.data.get('status') or '').upper()
        if new_status not in TICKET_STATUSES:
            return error('Noto‘g‘ri holat qiymati.')
        if not staff and new_status != 'CLOSED':
            return error('Siz faqat o‘z murojaatingizni yopishingiz mumkin.', status.HTTP_403_FORBIDDEN)
        old_status = ticket.status
        ticket.status = new_status
        resolution = str(request.data.get('resolution_notes') or '').strip()
        if resolution:
            ticket.resolution_notes = resolution[:5000]
        ticket.resolved_at = timezone.now() if new_status in ('RESOLVED', 'CLOSED') else None
        if staff and not ticket.assigned_to_id:
            ticket.assigned_to = request.user
        ticket.save()
        log_audit(request.user, 'SUPPORT_TICKET_STATUS', 'SUPPORT_TICKET', ticket.id, f'{old_status} -> {new_status}',
                  client_ip(request), target_name=ticket.subject, old_value=old_status, new_value=new_status)
        return Response(SupportTicketSerializer(ticket).data)
