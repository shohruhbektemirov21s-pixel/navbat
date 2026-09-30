from django.urls import path
from .views import (
    NotificationsListView, NotificationMarkReadView, NotificationReadAllView,
    TelegramBotInfoView, GenerateTelegramLinkTokenView, SendTestTelegramView,
    SendQueueTicketToTelegramView, SendBookingVoucherToTelegramView,
    AdminTelegramLogsView, AdminSendTelegramView
)

urlpatterns = [
    path('notifications', NotificationsListView.as_view(), name='notifications-list'),
    path('notifications/<str:pk>/read', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/read-all', NotificationReadAllView.as_view(), name='notifications-read-all'),

    path('telegram/bot-info', TelegramBotInfoView.as_view(), name='telegram-bot-info'),
    path('telegram/generate-link-token', GenerateTelegramLinkTokenView.as_view(), name='generate-link-token'),
    path('telegram/test', SendTestTelegramView.as_view(), name='telegram-test'),

    path('queue/<str:entry_id>/send-to-telegram', SendQueueTicketToTelegramView.as_view(), name='queue-send-telegram'),
    path('bookings/<str:booking_id>/send-to-telegram', SendBookingVoucherToTelegramView.as_view(), name='booking-send-telegram'),

    path('admin/telegram-logs', AdminTelegramLogsView.as_view(), name='admin-telegram-logs'),
    path('admin/telegram/send', AdminSendTelegramView.as_view(), name='admin-telegram-send'),
]
