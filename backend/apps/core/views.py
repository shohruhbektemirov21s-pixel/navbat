import platform
try:
    import resource
except ImportError:  # Windows does not provide the Unix resource module.
    resource = None
    import psutil
import shutil
import time
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import permissions, views
from rest_framework.response import Response

from apps.authentication.models import User, UserRole
from apps.authentication.permissions import IsFounderOrAdmin

from . import analytics
from .models import AuditLog
from .utils import local_today, month_start

PROCESS_STARTED = time.time()


def _bookings():
    from apps.bookings.models import Booking
    return Booking.objects


class PublicStatsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from apps.bookings.models import BookingStatus
        from apps.marketplace.models import Business
        from apps.queues.models import ACTIVE_QUEUE_STATUSES, QueueEntry

        today_bookings_statuses = (BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.IN_PROGRESS)
        return Response({
            'businesses': Business.objects.filter(status='APPROVED').count(),
            'customers': User.objects.filter(role=UserRole.CUSTOMER).count(),
            'queues': QueueEntry.objects.count(),
            'bookings': _bookings().count(),
            'activeQueueCount': QueueEntry.objects.filter(status__in=ACTIVE_QUEUE_STATUSES).count(),
            'todaysBookingsCount': _bookings().filter(
                booking_date=local_today(), status__in=today_bookings_statuses
            ).count(),
        })


def table_counts():
    from apps.marketplace.models import Business, Review, Service, Staff
    from apps.notifications.models import TelegramLog
    from apps.queues.models import QueueEntry
    from apps.subscriptions.models import SubscriptionTransaction

    return {
        'users': User.objects.count(),
        'businesses': Business.objects.count(),
        'bookings': _bookings().count(),
        'queue': QueueEntry.objects.count(),
        'services': Service.objects.count(),
        'staff': Staff.objects.count(),
        'reviews': Review.objects.count(),
        'audit_logs': AuditLog.objects.count(),
        'telegram_logs': TelegramLog.objects.count(),
        'transactions': SubscriptionTransaction.objects.count(),
    }


class SystemHealthView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        total, used, free = shutil.disk_usage(settings.BASE_DIR)
        try:
            connection.ensure_connection()
            db_status = 'connected'
        except Exception:  # pragma: no cover
            db_status = 'error'
        if resource is None:
            memory_mb = psutil.Process().memory_info().peak_wset / (1024 ** 2)
        else:
            max_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            memory_mb = max_rss / (1024 ** 2 if platform.system() == 'Darwin' else 1024)
        return Response({
            'status': 'HEALTHY' if db_status == 'connected' else 'DEGRADED',
            'uptimeSeconds': int(time.time() - PROCESS_STARTED),
            'memoryUsageMB': round(memory_mb),
            'pythonVersion': platform.python_version(),
            'databaseEngine': connection.vendor,
            'tableCounts': table_counts(),
            'timestamp': timezone.now().isoformat(),
            # Legacy keys
            'server_time': timezone.now().isoformat(),
            'database': db_status,
            'disk': {
                'total_gb': round(total / (2 ** 30), 2),
                'used_gb': round(used / (2 ** 30), 2),
                'free_gb': round(free / (2 ** 30), 2),
                'usage_percent': round((used / total) * 100, 1),
            },
            'bot_status': 'active' if settings.TELEGRAM_BOT_TOKEN else 'not_configured',
        })


class TelegramHealthView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        configured = bool(settings.TELEGRAM_BOT_TOKEN)
        return Response({
            'configured': configured,
            'tokenConfigured': configured,
            'bot_username': settings.TELEGRAM_BOT_USERNAME,
            'status': 'ONLINE' if configured else 'STANDBY',
            'checked_at': timezone.now().isoformat(),
        })


class AdminAuditLogsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        return Response([log.as_dict() for log in AuditLog.objects.order_by('-created_at')[:200]])


class AdminOverviewView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        from apps.marketplace.models import Business, Review, Service, Staff
        from apps.notifications.models import TelegramLog
        from apps.queues.models import QueueEntry

        today = local_today()
        now = timezone.now()
        completed = _bookings().filter(status='COMPLETED')
        biz = Business.objects.aggregate(
            total=Count('id'), active=Count('id', filter=Q(status='APPROVED')), pending=Count('id', filter=Q(status='PENDING')),
            expiring=Count('id', filter=Q(subscription_expires_at__gt=now, subscription_expires_at__lte=now + timedelta(days=3))),
            expired=Count('id', filter=Q(subscription_expires_at__lte=now)),
        )
        revenue_total = completed.aggregate(s=Sum('total_price_uzs'))['s'] or 0
        monthly_revenue = completed.filter(booking_date__gte=month_start()).aggregate(s=Sum('total_price_uzs'))['s'] or 0
        users_count = User.objects.count()
        bookings_count = _bookings().count()
        queue_total = QueueEntry.objects.count()
        reviews_count = Review.objects.count()
        return Response({
            'usersCount': users_count,
            'bizCount': biz['total'],
            'activeBizCount': biz['active'],
            'pendingBizCount': biz['pending'],
            'bookingsCount': bookings_count,
            'completedBookingsCount': completed.count(),
            'todayBookingsCount': _bookings().filter(booking_date=today).count(),
            'revenueTotal': revenue_total,
            'monthlyRevenue': monthly_revenue,
            'subscriptionRevenueThisMonth': analytics.payment_revenue(since=month_start()),
            'queueTotal': queue_total,
            'activeQueuesCount': QueueEntry.objects.filter(status='WAITING', queue_date=today).count(),
            'reviewsCount': reviews_count,
            'avgRating': analytics.avg_rating(),
            'expiringSoonCount': biz['expiring'],
            'expiredCount': biz['expired'],
            'telegramLogsCount': TelegramLog.objects.count(),
            # Legacy keys (real values)
            'totalBusinesses': biz['total'],
            'activeBusinesses': biz['active'],
            'totalUsers': users_count,
            'totalBookings': bookings_count,
            'totalQueues': queue_total,
            'totalReviews': reviews_count,
            'totalServices': Service.objects.count(),
            'totalStaff': Staff.objects.count(),
            'revenueThisMonth': monthly_revenue,
            'systemStatus': 'ONLINE',
        })


class AdminChartsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        from apps.marketplace.models import Category, City

        start = local_today() - timedelta(days=13)
        daily = {
            r['booking_date']: r for r in _bookings().filter(booking_date__gte=start, booking_date__lte=local_today())
            .values('booking_date').annotate(count=Count('id'), revenue=Sum('total_price_uzs', filter=Q(status='COMPLETED')))
        }
        daily_bookings = [
            {'date': (start + timedelta(days=i)).isoformat(),
             'count': daily.get(start + timedelta(days=i), {}).get('count', 0),
             'revenue': daily.get(start + timedelta(days=i), {}).get('revenue') or 0}
            for i in range(14)
        ]
        category_stats = [
            {'name': c.name, 'bookings_count': c.bookings_count, 'total_volume': c.total_volume or 0}
            for c in Category.objects.annotate(
                bookings_count=Count('businesses__bookings'), total_volume=Sum('businesses__bookings__total_price_uzs'),
            ).order_by('-bookings_count', 'name')
        ]
        city_stats = [
            {'name': c.name, 'businesses_count': c.businesses_count, 'bookings_count': c.bookings_count}
            for c in City.objects.annotate(
                businesses_count=Count('businesses', distinct=True), bookings_count=Count('businesses__bookings'),
            ).order_by('-businesses_count', 'name')
        ]
        weekday_names = ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Yak']
        return Response({
            'dailyBookings': daily_bookings,
            'categoryStats': category_stats,
            'cityStats': city_stats,
            # Legacy keys (real values)
            'bookingsTrend': [
                {'day': weekday_names[timezone.datetime.fromisoformat(d['date']).weekday()], 'count': d['count']}
                for d in daily_bookings[-7:]
            ],
            'categoriesDistribution': [{'name': c['name'], 'value': c['bookings_count']} for c in category_stats],
        })


class AdminReportsView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        from apps.marketplace.models import Business, Service
        from apps.queues.models import QueueEntry

        today = local_today()
        bookings = _bookings()
        completed = bookings.filter(status='COMPLETED')
        by_status = list(bookings.values('status').annotate(count=Count('id'), volume=Sum('total_price_uzs')).order_by('status'))
        status_counts = {row['status']: row['count'] for row in by_status}
        biz_counts = Business.objects.aggregate(
            total=Count('id'), approved=Count('id', filter=Q(status='APPROVED')),
            pending=Count('id', filter=Q(status='PENDING')), suspended=Count('id', filter=Q(status='SUSPENDED')),
            rejected=Count('id', filter=Q(status='REJECTED')), verified=Count('id', filter=Q(is_verified=True)),
        )
        top_performers = []
        for b in (Business.objects.select_related('category', 'city', 'owner')
                  .annotate(total_bookings=Count('bookings', distinct=True),
                            completed_bookings=Count('bookings', filter=Q(bookings__status='COMPLETED'), distinct=True),
                            total_revenue=Sum('bookings__total_price_uzs', filter=Q(bookings__status='COMPLETED')))
                  .order_by('-total_revenue', '-total_bookings')[:10]):
            rating = b.reviews.aggregate(a=Avg('rating'), c=Count('id'))
            top_performers.append({
                'id': b.id, 'name': b.name, 'slug': b.slug, 'status': b.status, 'is_verified': b.is_verified,
                'category_name': b.category.name, 'city_name': b.city.name, 'owner_name': b.owner.name,
                'owner_phone': b.owner.phone, 'total_bookings': b.total_bookings,
                'completed_bookings': b.completed_bookings, 'total_revenue': b.total_revenue or 0,
                'rating': round(rating['a'], 1) if rating['a'] is not None else None, 'reviews_count': rating['c'],
                'staff_count': b.staff.count(), 'services_count': b.services.count(),
            })
        top_services = [
            {'id': s.id, 'service_name': s.name, 'price_uzs': s.price_uzs, 'business_name': s.business.name,
             'category_name': s.business.category.name, 'bookings_count': s.bookings_count,
             'total_revenue': s.total_revenue or 0}
            for s in Service.objects.select_related('business__category').annotate(
                bookings_count=Count('bookings'),
                total_revenue=Sum('bookings__total_price_uzs', filter=Q(bookings__status='COMPLETED')),
            ).order_by('-bookings_count', '-total_revenue')[:8]
        ]
        queue_stats = QueueEntry.objects.aggregate(
            total_tickets=Count('id'), waiting_count=Count('id', filter=Q(status='WAITING')),
            serving_count=Count('id', filter=Q(status='SERVING')), completed_count=Count('id', filter=Q(status='COMPLETED')),
            cancelled_count=Count('id', filter=Q(status__in=['SKIPPED', 'NO_SHOW'])),
        )
        monthly_trends = [
            {'month': row['month'].strftime('%Y-%m'), 'bookings_count': row['bookings_count'],
             'completed_count': row['completed_count'], 'revenue': row['revenue'] or 0}
            for row in bookings.filter(booking_date__gte=today - timedelta(days=183))
            .annotate(month=TruncMonth('booking_date')).values('month')
            .annotate(bookings_count=Count('id'), completed_count=Count('id', filter=Q(status='COMPLETED')),
                      revenue=Sum('total_price_uzs', filter=Q(status='COMPLETED')))
            .order_by('month')
        ]
        users_by_role = list(User.objects.values('role').annotate(count=Count('id')).order_by('role'))
        avg_value = completed.aggregate(a=Avg('total_price_uzs'))['a']
        return Response({
            'financial': {
                'totalGrossRevenue': completed.aggregate(s=Sum('total_price_uzs'))['s'] or 0,
                'monthlyGrossRevenue': completed.filter(booking_date__gte=month_start()).aggregate(s=Sum('total_price_uzs'))['s'] or 0,
                'todayGrossRevenue': completed.filter(booking_date=today).aggregate(s=Sum('total_price_uzs'))['s'] or 0,
                'avgBookingValue': round(avg_value) if avg_value else 0,
                'totalBookingsCount': bookings.count(),
                'completedCount': status_counts.get('COMPLETED', 0),
                'confirmedCount': status_counts.get('CONFIRMED', 0),
                'pendingBookingsCount': status_counts.get('PENDING', 0),
                'cancelledCount': status_counts.get('CANCELLED', 0),
                'bookingsByStatus': [{**row, 'volume': row['volume'] or 0} for row in by_status],
                'subscriptionRevenueTotal': analytics.payment_revenue(),
            },
            'businesses': {**biz_counts, 'topPerformers': top_performers},
            'users': {
                'total': User.objects.count(),
                'active': User.objects.filter(status='ACTIVE', is_active=True).count(),
                'blocked': User.objects.filter(Q(status='SUSPENDED') | Q(is_active=False)).count(),
                'roles': users_by_role,
            },
            'topServices': top_services,
            'queueStats': queue_stats,
            'monthlyTrends': monthly_trends,
            'generatedAt': timezone.now().isoformat(),
            'summary': {
                'activePilots': biz_counts['approved'],
                'pendingApprovals': biz_counts['pending'],
                'status': 'ON_TRACK' if biz_counts['approved'] else 'NOT_STARTED',
            },
        })
