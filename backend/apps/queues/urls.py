from django.urls import path
from .views import (
    JoinQueueView, MyActiveQueueView, BusinessQueueView,
    CurrentQueueStateView, WaitingQueueListView, OperatorCallNextView,
    OperatorAcceptView, OperatorCancelView, CompleteQueueServiceView,
    NoShowQueueCustomerView, QueueAuditLogsView, PublicQueueBoardView,
    ResolveQRCodeView, InstantQueueCheckInView, AdminQueuesListView
)

urlpatterns = [
    path('queue/join', JoinQueueView.as_view(), name='queue-join'),
    path('queue/my-active', MyActiveQueueView.as_view(), name='queue-my-active'),
    path('business/<str:business_id>/queue', BusinessQueueView.as_view(), name='business-queue'),
    path('queue/current', CurrentQueueStateView.as_view(), name='queue-current'),
    path('queue/waiting', WaitingQueueListView.as_view(), name='queue-waiting'),

    # Operator endpoints
    path('operator/queue/call-next', OperatorCallNextView.as_view(), name='operator-call-next'),
    path('operator/queue/accept', OperatorAcceptView.as_view(), name='operator-accept'),
    path('operator/queue/cancel', OperatorCancelView.as_view(), name='operator-cancel'),
    path('queue/complete', CompleteQueueServiceView.as_view(), name='queue-complete'),
    path('queue/no-show', NoShowQueueCustomerView.as_view(), name='queue-no-show'),
    path('queue/audit-logs/<str:business_id>', QueueAuditLogsView.as_view(), name='queue-audit-logs'),

    # QR Check-in & Public Board
    path('check-in/resolve', ResolveQRCodeView.as_view(), name='check-in-resolve'),
    path('check-in/instant-queue', InstantQueueCheckInView.as_view(), name='check-in-instant'),
    path('public-queue/<str:slug>', PublicQueueBoardView.as_view(), name='public-queue-board'),

    # Admin Queues
    path('admin/queues', AdminQueuesListView.as_view(), name='admin-queues'),
]
