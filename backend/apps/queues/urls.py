from django.urls import path

from .views import (
    AdminQueuesListView, BusinessQueueView, CompleteQueueServiceView, CurrentQueueStateView, InstantQueueCheckInView,
    JoinQueueView, MyActiveQueueView, NoShowQueueCustomerView, OperatorAcceptView, OperatorCallNextView,
    OperatorCancelView, PublicQueueBoardView, QueueAuditLogsView, QueueEntryActionView, QueueNextConfirmView,
    QueueNextRequestView, QueuePendingCancelView, QueuePendingStatusView, ResolveQRCodeView, WaitingQueueListView,
)

urlpatterns = [
    path('queue/join', JoinQueueView.as_view(), name='queue-join'),
    path('queue/my-active', MyActiveQueueView.as_view(), name='queue-my-active'),
    path('business/<str:business_id>/queue', BusinessQueueView.as_view(), name='business-queue'),
    path('business/queue/<str:entry_id>/action', QueueEntryActionView.as_view(), name='business-queue-action'),
    path('queue/current', CurrentQueueStateView.as_view(), name='queue-current'),
    path('queue/waiting', WaitingQueueListView.as_view(), name='queue-waiting'),

    # "Call next" with confirmation (web fallback button / Telegram inline button)
    path('queue/next/request', QueueNextRequestView.as_view(), name='queue-next-request'),
    path('queue/next/confirm', QueueNextConfirmView.as_view(), name='queue-next-confirm'),
    path('queue/pending-cancel', QueuePendingCancelView.as_view(), name='queue-pending-cancel'),
    path('queue/pending-status/<str:action_id>', QueuePendingStatusView.as_view(), name='queue-pending-status'),

    # Operator endpoints
    path('operator/queue/call-next', OperatorCallNextView.as_view(), name='operator-call-next'),
    path('operator/queue/accept', OperatorAcceptView.as_view(), name='operator-accept'),
    path('operator/queue/cancel', OperatorCancelView.as_view(), name='operator-cancel'),
    path('queue/complete', CompleteQueueServiceView.as_view(), name='queue-complete'),
    path('queue/no-show', NoShowQueueCustomerView.as_view(), name='queue-no-show'),
    path('queue/audit-logs/<str:business_id>', QueueAuditLogsView.as_view(), name='queue-audit-logs'),

    # QR check-in & public board
    path('check-in/resolve', ResolveQRCodeView.as_view(), name='check-in-resolve'),
    path('check-in/instant-queue', InstantQueueCheckInView.as_view(), name='check-in-instant'),
    path('public-queue/<str:slug>', PublicQueueBoardView.as_view(), name='public-queue-board'),

    # Admin
    path('admin/queues', AdminQueuesListView.as_view(), name='admin-queues'),
]
