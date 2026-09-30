from django.urls import path
from .views import PartnerSupportTicketsView, SupportTicketStatusUpdateView

urlpatterns = [
    path('partner/support-tickets', PartnerSupportTicketsView.as_view(), name='partner-support-tickets'),
    path('partner/support-tickets/<str:pk>/status', SupportTicketStatusUpdateView.as_view(), name='support-ticket-status'),
]
