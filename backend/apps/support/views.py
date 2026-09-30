from rest_framework import views, permissions, status
from rest_framework.response import Response

from .models import SupportTicket
from .serializers import SupportTicketSerializer


class PartnerSupportTicketsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tickets = SupportTicket.objects.all().order_by('-created_at')
        return Response(SupportTicketSerializer(tickets, many=True).data)

    def post(self, request):
        data = request.data
        tkt = SupportTicket.objects.create(
            user=request.user,
            subject=data.get('subject', 'Yangi murojaat'),
            message=data.get('message', ''),
            priority=data.get('priority', 'MEDIUM'),
            status='OPEN'
        )
        return Response(SupportTicketSerializer(tkt).data, status=status.HTTP_201_CREATED)


class SupportTicketStatusUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        tkt = SupportTicket.objects.filter(id=pk).first()
        if not tkt:
            return Response({'error': 'Murojaat topilmadi'}, status=404)

        new_status = request.data.get('status')
        resolution = request.data.get('resolution_notes')
        if new_status:
            tkt.status = new_status
        if resolution:
            tkt.resolution_notes = resolution
        tkt.save()
        return Response(SupportTicketSerializer(tkt).data)
