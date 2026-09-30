from django.urls import path
from .views import (
    PublicStatsView, SystemHealthView, TelegramHealthView,
    AdminAuditLogsView, AdminOverviewView, AdminChartsView, AdminReportsView
)

urlpatterns = [
    path('public-stats', PublicStatsView.as_view(), name='public-stats'),
    path('admin/system-health', SystemHealthView.as_view(), name='admin-system-health'),
    path('admin/overview', AdminOverviewView.as_view(), name='admin-overview'),
    path('admin/stats-charts', AdminChartsView.as_view(), name='admin-charts'),
    path('admin/reports', AdminReportsView.as_view(), name='admin-reports'),
    path('telegram/health', TelegramHealthView.as_view(), name='telegram-health'),
    path('admin/audit-logs', AdminAuditLogsView.as_view(), name='admin-audit-logs'),
]
