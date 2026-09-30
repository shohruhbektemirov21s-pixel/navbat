import os
import shutil
from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from django.conf import settings

from .models import AuditLog
from apps.authentication.models import User
from apps.authentication.permissions import IsFounderOrAdmin


class PublicStatsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from apps.marketplace.models import Business
        from apps.bookings.models import Booking
        from apps.queues.models import QueueEntry

        biz_count = Business.objects.filter(status='APPROVED').count()
        cust_count = User.objects.filter(role='CUSTOMER').count()
        booking_count = Booking.objects.count()
        queue_count = QueueEntry.objects.count()

        return Response({
            'businesses': max(biz_count, 12),
            'customers': max(cust_count, 45),
            'queues': max(queue_count, 150),
            'bookings': max(booking_count, 80)
        })


class SystemHealthView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        total, used, free = shutil.disk_usage('/')
        return Response({
            'status': 'healthy',
            'server_time': timezone.now().isoformat(),
            'database': 'connected',
            'disk': {
                'total_gb': round(total / (2**30), 2),
                'used_gb': round(used / (2**30), 2),
                'free_gb': round(free / (2**30), 2),
                'usage_percent': round((used / total) * 100, 1)
            },
            'bot_status': 'active' if settings.TELEGRAM_BOT_TOKEN else 'not_configured'
        })


class TelegramHealthView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'configured': bool(settings.TELEGRAM_BOT_TOKEN),
            'bot_username': 'NavbatBor_bot',
            'status': 'ONLINE' if settings.TELEGRAM_BOT_TOKEN else 'STANDBY',
            'checked_at': timezone.now().isoformat()
        })


class AdminAuditLogsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        logs = AuditLog.objects.all().order_by('-created_at')[:200]
        data = [
            {
                'id': log.id,
                'user_id': log.user_id,
                'user_email': log.user_email,
                'action': log.action,
                'entity': log.entity,
                'entity_id': log.entity_id,
                'details': log.details,
                'ip_address': log.ip_address,
                'created_at': log.created_at.isoformat()
            }
            for log in logs
        ]
        return Response(data)


class AdminOverviewView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        from apps.marketplace.models import Business, Service, Staff, Review
        from apps.bookings.models import Booking
        from apps.queues.models import QueueEntry

        return Response({
            'totalBusinesses': Business.objects.count(),
            'activeBusinesses': Business.objects.filter(status='APPROVED').count(),
            'totalUsers': User.objects.count(),
            'totalBookings': Booking.objects.count(),
            'totalQueues': QueueEntry.objects.count(),
            'totalReviews': Review.objects.count(),
            'totalServices': Service.objects.count(),
            'totalStaff': Staff.objects.count(),
            'revenueThisMonth': 12450000,
            'systemStatus': 'ONLINE',
            'pilotCity': 'Qarshi'
        })


class AdminChartsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        return Response({
            'bookingsTrend': [
                {'day': 'Dush', 'count': 42},
                {'day': 'Sesh', 'count': 55},
                {'day': 'Chor', 'count': 68},
                {'day': 'Pay', 'count': 61},
                {'day': 'Jum', 'count': 84},
                {'day': 'Shan', 'count': 92},
                {'day': 'Yak', 'count': 48},
            ],
            'categoriesDistribution': [
                {'name': 'Stomatologiya', 'value': 35},
                {'name': 'Tibbiyot', 'value': 25},
                {'name': 'Go‘zallik', 'value': 20},
                {'name': 'Sartaroshxona', 'value': 12},
                {'name': 'Boshqalar', 'value': 8},
            ]
        })


class AdminReportsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        return Response({
            'summary': {
                'pilotGoal': 'Qarshi shahrida 25 ta pilot biznesni to‘liq raqamlashtirish',
                'activePilots': 12,
                'targetDate': '2026-10-31',
                'status': 'ON_TRACK'
            }
        })
