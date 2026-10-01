"""Real aggregates shared by admin and operating-partner dashboards (no placeholder numbers)."""
from datetime import timedelta

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from .utils import local_today, month_start


def confirmed_payments():
    from apps.subscriptions.models import SubscriptionTransaction, TransactionStatus
    return (
        SubscriptionTransaction.objects.filter(status=TransactionStatus.CONFIRMED, amount_uzs__gt=0)
        .annotate(paid_on=Coalesce('confirmed_at', 'created_at'))
    )


def payment_revenue(*, since=None, on=None):
    qs = confirmed_payments()
    if since is not None:
        qs = qs.filter(paid_on__date__gte=since)
    if on is not None:
        qs = qs.filter(paid_on__date=on)
    return qs.aggregate(s=Sum('amount_uzs'))['s'] or 0


def active_business_q():
    now = timezone.now()
    return Q(status='APPROVED') & (Q(subscription_expires_at__isnull=True) | Q(subscription_expires_at__gt=now))


def avg_rating():
    from apps.marketplace.models import Review
    value = Review.objects.aggregate(a=Avg('rating'))['a']
    return round(float(value), 1) if value is not None else None


def avg_support_resolution_minutes():
    from apps.support.models import SupportTicket
    duration = ExpressionWrapper(F('resolved_at') - F('created_at'), output_field=DurationField())
    value = SupportTicket.objects.filter(resolved_at__isnull=False).annotate(d=duration).aggregate(a=Avg('d'))['a']
    return int(value.total_seconds() // 60) if value else 0


def retention_rate():
    """% of businesses that ever paid which still have an active subscription."""
    from apps.marketplace.models import Business
    paying_ids = confirmed_payments().values_list('business_id', flat=True).distinct()
    total = Business.objects.filter(id__in=paying_ids).count()
    if not total:
        return 0
    active = Business.objects.filter(id__in=paying_ids).filter(active_business_q()).count()
    return round(active * 100 / total)


def daily_bookings_trend(days=7):
    from apps.bookings.models import Booking
    start = local_today() - timedelta(days=days - 1)
    rows = {
        r['d']: r for r in Booking.objects.filter(created_at__date__gte=start)
        .values(d=TruncDate('created_at')).annotate(bookings=Count('id'), revenue=Sum('total_price_uzs'))
    }
    return [
        {'date': (start + timedelta(days=i)).isoformat(),
         'bookings': rows.get(start + timedelta(days=i), {}).get('bookings', 0),
         'revenue': rows.get(start + timedelta(days=i), {}).get('revenue') or 0}
        for i in range(days)
    ]


def pct(actual, target):
    return min(100, round(actual * 100 / target)) if target else 0


KPI_TARGETS = {
    'newBusinesses': 10,
    'activeBusinesses': 15,
    'newPayingClients': 8,
    'monthlyRevenue': 2_500_000,
    'retentionRate': 90,
    'churnRate': 10,
    'supportResolutionMinutes': 60,
}


def partner_kpis():
    from apps.marketplace.models import Business
    from apps.partners.models import CRMLead

    start = month_start()
    new_biz = Business.objects.filter(created_at__date__gte=start).count()
    active_biz = Business.objects.filter(active_business_q()).count()
    paying = CRMLead.objects.filter(status__in=['PAID', 'ACTIVE']).count()
    monthly_revenue = payment_revenue(since=start)
    retention = retention_rate()
    churn = (100 - retention) if confirmed_payments().exists() else 0
    rating = avg_rating()
    resolution = avg_support_resolution_minutes()
    return {
        'newBusinesses': {'actual': new_biz, 'target': KPI_TARGETS['newBusinesses'], 'percentage': pct(new_biz, KPI_TARGETS['newBusinesses'])},
        'activeBusinesses': {'actual': active_biz, 'target': KPI_TARGETS['activeBusinesses'], 'percentage': pct(active_biz, KPI_TARGETS['activeBusinesses'])},
        'newPayingClients': {'actual': paying, 'target': KPI_TARGETS['newPayingClients'], 'percentage': pct(paying, KPI_TARGETS['newPayingClients'])},
        'monthlyRevenue': {'actual': monthly_revenue, 'target': KPI_TARGETS['monthlyRevenue'], 'percentage': pct(monthly_revenue, KPI_TARGETS['monthlyRevenue'])},
        'retentionRate': {'actual': retention, 'target': KPI_TARGETS['retentionRate'], 'percentage': retention},
        'churnRate': {'actual': churn, 'target': KPI_TARGETS['churnRate'], 'percentage': churn},
        'customerSatisfaction': {
            'actual': rating or 0, 'target': 5.0,
            'score': f'{rating} / 5.0 ({round(rating / 5 * 100)}%)' if rating is not None else 'Sharhlar yo‘q',
        },
        'supportResolutionTime': {
            'actualMinutes': resolution, 'targetMinutes': KPI_TARGETS['supportResolutionMinutes'],
            'text': f'{resolution} daqiqa (o‘rtacha)' if resolution else 'Ma’lumot yo‘q',
        },
    }
