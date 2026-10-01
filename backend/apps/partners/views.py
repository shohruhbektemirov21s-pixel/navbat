import re
import secrets
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status, views
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from apps.authentication.models import User, UserRole, UserStatus
from apps.authentication.permissions import ADMIN_ROLES, IsFounderOrAdmin, IsOperatingPartner, has_role
from apps.authentication.serializers import PublicTeamMemberSerializer, UserSerializer, run_password_validators
from apps.core import analytics
from apps.core.exceptions import _first_message
from apps.core.models import AuditLog, log_audit
from apps.core.utils import client_ip, local_today, month_start, parse_date, parse_int
from apps.marketplace.models import Business, BusinessStatus, Category, City, Service, Staff
from apps.marketplace.services import unique_business_slug
from apps.marketplace.views import apply_business_status
from apps.subscriptions import services as billing
from apps.subscriptions.models import SubscriptionPlan

from .models import CRMLead, LeadStage, PartnerCommission, PartnerReport
from .serializers import CRMLeadSerializer, PartnerCommissionSerializer, PartnerReportSerializer

TEAM_ROLES = (UserRole.OPERATING_PARTNER, UserRole.SALES_MANAGER, UserRole.BUSINESS_MANAGER, UserRole.SUPPORT)
# Audit entities partner-side staff may browse (USER entries contain account PII -> admins only).
PARTNER_AUDIT_ENTITIES = ('BUSINESS', 'LEAD', 'COMMISSION', 'REPORT', 'SUPPORT_TICKET', 'SERVICE', 'STAFF', 'TRANSACTION')


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def is_admin(user):
    return has_role(user, ADMIN_ROLES)


def temp_password():
    """Strong one-time password handed to a newly created business owner."""
    return f'Nb-{secrets.token_urlsafe(9)}'


def resolve_owner_password(raw, owner_probe):
    """Return (password, generated?) — generates one when missing; rejects weak supplied passwords."""
    raw = raw or ''
    if not raw.strip():
        return temp_password(), True
    try:
        run_password_validators(raw, owner_probe)
    except ValidationError as exc:
        raise ValidationError({'error': _first_message(exc.detail)})
    return raw, False


def commissions_for(user):
    qs = PartnerCommission.objects.select_related('business', 'partner')
    return qs if is_admin(user) else qs.filter(partner=user)


def commission_summary(qs):
    agg = qs.aggregate(
        total=Sum('total_amount_uzs'), partner=Sum('amount_uzs'), navbatbor=Sum('navbatbor_share_uzs'),
        paid=Sum('amount_uzs', filter=Q(status='PAID')), pending=Sum('amount_uzs', filter=Q(status='PENDING')),
        count=Count('id'),
    )
    summary = {
        'totalRevenue': agg['total'] or 0,
        'partnerCommission': agg['partner'] or 0,
        'navbatBorRevenue': agg['navbatbor'] or 0,
        'paidCommission': agg['paid'] or 0,
        'pendingCommission': agg['pending'] or 0,
        'partnerRatePercent': 30,
        'commissionsCount': agg['count'] or 0,
    }
    # Legacy keys
    summary.update({'total_earned': summary['partnerCommission'], 'pending_payout': summary['pendingCommission'],
                    'total_settled': summary['paidCommission']})
    return summary


def leads_for(user):
    qs = CRMLead.objects.select_related('assigned_to')
    # Leads are created with assigned_to=creator (see CRMLeadsListView.post); non-admin partner-side
    # staff (operating partner, sales manager) may only see/manage their own leads, never another
    # partner's — otherwise a second OPERATING_PARTNER account could view/convert their leads.
    if not is_admin(user):
        qs = qs.filter(assigned_to=user)
    return qs


def audit_logs_for(user):
    qs = AuditLog.objects.all()
    return qs if is_admin(user) else qs.filter(entity__in=PARTNER_AUDIT_ENTITIES)


# ---------------------------------------------------------------------------
# Overview & KPIs
# ---------------------------------------------------------------------------
class PartnerOverviewView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def get(self, request):
        from apps.bookings.models import Booking
        from apps.queues.models import QueueEntry
        from apps.support.models import SupportTicket

        start = month_start()
        today = local_today()
        monthly_revenue = analytics.payment_revenue(since=start)
        tariffs = {'FREE': 0, 'START': 0, 'PRO': 0, 'BUSINESS': 0}
        for row in Business.objects.values('subscription_plan_code').annotate(c=Count('id')):
            code = (row['subscription_plan_code'] or '').upper()
            if code in tariffs:
                tariffs[code] = row['c']
        pipeline = {stage: 0 for stage in LeadStage.values}
        for row in leads_for(request.user).values('status').annotate(c=Count('id')):
            if row['status'] in pipeline:
                pipeline[row['status']] = row['c']
        support = SupportTicket.objects.aggregate(
            total=Count('id'), open=Count('id', filter=Q(status='OPEN')),
            in_progress=Count('id', filter=Q(status='IN_PROGRESS')),
            resolved=Count('id', filter=Q(status__in=['RESOLVED', 'CLOSED'])),
        )
        total_biz = Business.objects.count()
        leads_total = sum(pipeline.values())
        won = pipeline['PAID'] + pipeline['ACTIVE']
        return Response({
            'todayRevenue': analytics.payment_revenue(on=today),
            'monthlyRevenue': monthly_revenue,
            'partnerMonthlyCommission': round(monthly_revenue * 0.30),
            'newBusinessesThisMonth': Business.objects.filter(created_at__date__gte=start).count(),
            'activeBusinessesCount': Business.objects.filter(analytics.active_business_q()).count(),
            'totalBusinessesCount': total_biz,
            'newCustomersThisMonth': User.objects.filter(role=UserRole.CUSTOMER, created_at__date__gte=start).count(),
            'totalQueueCount': QueueEntry.objects.count(),
            'cancelledQueueCount': (QueueEntry.objects.filter(status__in=['SKIPPED', 'NO_SHOW']).count()
                                    + Booking.objects.filter(status__in=['CANCELLED', 'NO_SHOW']).count()),
            'activeTariffsBreakdown': tariffs,
            'crmPipelineCounts': pipeline,
            'supportStats': {'total': support['total'], 'open': support['open'],
                             'inProgress': support['in_progress'], 'resolved': support['resolved']},
            'commissionSummary': commission_summary(commissions_for(request.user)),
            'kpis': analytics.partner_kpis(),
            'recentActivities': [log.as_dict() for log in audit_logs_for(request.user).order_by('-created_at')[:15]],
            'dailyTrend': analytics.daily_bookings_trend(7),
            # Legacy keys (real values)
            'pilotBusinesses': total_biz,
            'crmLeadsCount': leads_total,
            'conversionRate': f'{round(won * 100 / leads_total, 1) if leads_total else 0}%',
        })


class PartnerKPIsView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def get(self, request):
        kpis = analytics.partner_kpis()
        return Response({
            **kpis,
            'pilot_goal': analytics.KPI_TARGETS['activeBusinesses'],
            'pilot_achieved': kpis['activeBusinesses']['actual'],
            'monthly_revenue_uzs': kpis['monthlyRevenue']['actual'],
            'commission_rate_percent': 30,
            'customer_satisfaction_score': analytics.avg_rating(),
        })


# ---------------------------------------------------------------------------
# Businesses
# ---------------------------------------------------------------------------
def partner_business_rows(qs):
    rows = []
    for b in qs.select_related('owner', 'category', 'city').prefetch_related('services', 'staff'):
        services = [{'id': s.id, 'name': s.name, 'price': s.price_uzs, 'price_uzs': s.price_uzs,
                     'duration_minutes': s.duration_minutes, 'is_active': s.is_active} for s in b.services.all()]
        staff = [{'id': s.id, 'name': s.name, 'title': s.title, 'phone': s.phone, 'is_active': s.is_active}
                 for s in b.staff.all()]
        rows.append({
            'id': b.id, 'name': b.name, 'slug': b.slug, 'status': b.status, 'is_verified': b.is_verified,
            'is_sponsored': b.is_sponsored, 'phone': b.phone, 'address': b.address, 'district': b.district,
            'description': b.description, 'category_id': b.category_id, 'category_name': b.category.name,
            'city_id': b.city_id, 'city_name': b.city.name, 'latitude': b.latitude, 'longitude': b.longitude,
            'subscription_plan_code': b.subscription_plan_code,
            'subscription_expires_at': b.subscription_expires_at.isoformat() if b.subscription_expires_at else None,
            'subscription_status': billing.subscription_status(b), 'days_left': billing.days_left(b) or 0,
            'is_trial': b.is_trial, 'owner_id': b.owner_id, 'owner_name': b.owner.name, 'owner_email': b.owner.email,
            'owner_phone': b.owner.phone, 'partner_id': b.partner_id, 'services': services, 'staff': staff,
            'services_count': len(services), 'staff_count': len(staff), 'created_at': b.created_at.isoformat(),
        })
    return rows


def get_or_create_owner(*, name, email, phone, password_raw):
    """Returns (owner, temp_password_or_None). Never re-purposes privileged accounts."""
    owner = User.objects.filter(email__iexact=email).first()
    if owner:
        if owner.role in (*ADMIN_ROLES, UserRole.OPERATING_PARTNER, UserRole.SALES_MANAGER, UserRole.SUPPORT):
            raise ValidationError({'error': 'Bu email jamoa a’zosiga tegishli, biznes egasi sifatida ishlatib bo‘lmaydi.'})
        if owner.role == UserRole.CUSTOMER:
            owner.role = UserRole.BUSINESS_OWNER
            owner.save(update_fields=['role'])
        return owner, None
    password, generated = resolve_owner_password(password_raw, User(email=email, name=name))
    owner = User.objects.create_user(email=email, password=password, name=name[:255], phone=phone[:32] or None,
                                     role=UserRole.BUSINESS_OWNER, status=UserStatus.ACTIVE)
    return owner, (password if generated else None)


def create_partner_business(*, partner, owner, name, category, city, address, phone, description='', latitude=None,
                            longitude=None, staff_name=None):
    business = Business.objects.create(
        owner=owner, partner=partner if partner.role == UserRole.OPERATING_PARTNER else None, name=name[:255],
        slug=unique_business_slug(name), category=category, city=city, address=address[:255], phone=phone[:32],
        description=description[:5000], latitude=latitude, longitude=longitude,
        # Created by the approving side (partner/admin), so it goes live immediately.
        status=BusinessStatus.APPROVED, is_verified=True, subscription_plan_code='PRO',
    )
    billing.activate_trial(business)
    service = Service.objects.create(business=business, name='Asosiy xizmat', description='Standart professional xizmat',
                                     price_uzs=50000, duration_minutes=30)
    staff = Staff.objects.create(business=business, name=(staff_name or owner.name)[:255], title='Mutaxassis', phone=phone[:32])
    staff.services.set([service])
    return business


class PartnerBusinessesView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def get(self, request):
        return Response(partner_business_rows(Business.objects.order_by('-created_at')))

    def post(self, request):
        data = request.data
        name = str(data.get('name') or '').strip()
        address = str(data.get('address') or '').strip()
        phone = str(data.get('phone') or '').strip()
        owner_name = str(data.get('owner_name') or '').strip()
        owner_email = str(data.get('owner_email') or '').strip().lower()
        if not all([name, data.get('category_id'), address, phone, owner_name, owner_email]):
            return error('Barcha asosiy maydonlarni to‘ldiring (nom, toifa, manzil, telefon, egasi).')
        category = Category.objects.filter(Q(id=data.get('category_id')) | Q(slug=data.get('category_id'))).first()
        city = City.objects.filter(id=data.get('city_id') or 'city-qarshi').first() or City.objects.order_by('name').first()
        if not category or not city:
            return error('Kategoriya yoki shahar topilmadi.')

        with transaction.atomic():
            owner, temp = get_or_create_owner(name=owner_name, email=owner_email,
                                              phone=str(data.get('owner_phone') or phone), password_raw=data.get('owner_password'))
            business = create_partner_business(
                partner=request.user, owner=owner, name=name, category=category, city=city, address=address, phone=phone,
                description=str(data.get('description') or ''), latitude=_float(data.get('latitude')),
                longitude=_float(data.get('longitude')), staff_name=owner_name,
            )
            plan_code = str(data.get('subscription_plan_code') or data.get('plan_code') or '').upper()
            tx = _maybe_request_plan(business, request.user, plan_code)

        log_audit(request.user, 'BUSINESS_CREATED_BY_PARTNER', 'BUSINESS', business.id, f'{name} ({plan_code or "PRO trial"})',
                  client_ip(request), target_name=name, new_value=plan_code)
        return Response({
            'success': True, 'id': business.id, 'slug': business.slug,
            'business': partner_business_rows(Business.objects.filter(pk=business.pk))[0],
            'owner_login': owner.email, 'owner_temp_password': temp,
            'pending_transaction_id': tx.id if tx else None,
            'message': 'Yangi biznes ro‘yxatga olindi va faollashtirildi (14 kunlik sinov).',
        }, status=status.HTTP_201_CREATED)


def _float(value):
    try:
        return float(value) if value not in (None, '') else None
    except (TypeError, ValueError):
        return None


def _maybe_request_plan(business, user, plan_code, months=1):
    """Paid plans chosen by partners become PENDING payment requests (admins confirm after payment)."""
    if not plan_code:
        return None
    plan = SubscriptionPlan.objects.filter(code=plan_code).first()
    if not plan:
        raise ValidationError({'error': 'Tarif rejasi topilmadi.'})
    if plan.price_uzs <= 0:
        return None
    tx, _ = billing.request_subscription_payment(business, user, plan.code, months, 'PARTNER_ASSIGNED')
    return tx


class PartnerBusinessStatusUpdateView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def post(self, request, business_id):
        biz = Business.objects.select_related('owner').filter(id=business_id).first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        if not request.data.get('status'):
            return error('status kiritilishi shart.')
        payload = apply_business_status(biz, request)
        payload['message'] = f'Biznes holati {biz.status} ga o‘zgartirildi.'
        return Response(payload)


class PartnerBusinessTariffUpdateView(views.APIView):
    """Partners create a PENDING payment request; admins/founders extend immediately."""
    permission_classes = [IsOperatingPartner]

    def post(self, request, business_id):
        biz = Business.objects.filter(id=business_id).first()
        if not biz:
            return error('Biznes topilmadi.', status.HTTP_404_NOT_FOUND)
        plan_code = str(request.data.get('plan_code') or 'PRO').upper()
        months = parse_int(request.data.get('months'), default=1, min_value=1, max_value=12, field='months')
        billing.get_plan(plan_code)
        if is_admin(request.user):
            billing.extend_subscription(biz, months, plan_code)
            log_audit(request.user, 'BUSINESS_TARIFF_UPDATED', 'BUSINESS', biz.id, f'{plan_code} +{months} oy',
                      client_ip(request), target_name=biz.name, new_value=plan_code)
            return Response({'success': True, 'status': 'CONFIRMED', 'plan_code': plan_code,
                             'expires_at': biz.subscription_expires_at.isoformat()})
        tx = _maybe_request_plan(biz, request.user, plan_code, months)
        log_audit(request.user, 'BUSINESS_TARIFF_REQUESTED', 'BUSINESS', biz.id, f'{plan_code} x {months} oy',
                  client_ip(request), target_name=biz.name, new_value=plan_code)
        return Response({'success': True, 'status': 'PENDING', 'plan_code': plan_code,
                         'transactionId': tx.id if tx else None,
                         'message': 'To‘lov so‘rovi yaratildi. Administrator tasdiqlagach tarif faollashadi.'})


# ---------------------------------------------------------------------------
# CRM
# ---------------------------------------------------------------------------
LEAD_TEXT_FIELDS = {
    'business_name': ('business_name', 255), 'owner_name': ('contact_person', 255), 'contact_person': ('contact_person', 255),
    'phone': ('phone', 32), 'telegram_username': ('telegram_username', 128), 'address': ('address', 255),
    'business_type': ('category', 128), 'category': ('category', 128), 'city': ('city', 128), 'notes': ('notes', 5000),
}


def apply_lead_input(lead, data):
    for key, (field, max_len) in LEAD_TEXT_FIELDS.items():
        if key in data and data.get(key) is not None:
            setattr(lead, field, str(data.get(key)).strip()[:max_len])
    if 'status' in data and data.get('status'):
        if data['status'] not in LeadStage.values:
            raise ValidationError({'error': 'Noto‘g‘ri CRM bosqichi.'})
        lead.status = data['status']
    if 'deal_value_uzs' in data:
        lead.deal_value_uzs = parse_int(data.get('deal_value_uzs'), default=0, min_value=0, field='deal_value_uzs')
    for key in ('last_contact_date', 'next_contact_date'):
        if key in data:
            setattr(lead, key, parse_date(data[key], key) if data.get(key) else None)
    if not lead.business_name or not lead.contact_person or not lead.phone:
        raise ValidationError({'error': 'Biznes nomi, egasi va telefonni to‘ldiring.'})
    return lead


def get_lead(request, pk):
    lead = leads_for(request.user).filter(id=pk).first()
    if not lead:
        raise NotFound('Lead topilmadi.')
    return lead


class CRMLeadsListView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def get(self, request):
        qs = leads_for(request.user)
        search = request.query_params.get('search', '').strip()
        stage = request.query_params.get('status', '').strip()
        if search:
            qs = qs.filter(Q(business_name__icontains=search) | Q(contact_person__icontains=search) |
                           Q(phone__icontains=search) | Q(address__icontains=search))
        if stage and stage != 'ALL':
            qs = qs.filter(status=stage)
        return Response(CRMLeadSerializer(qs.order_by('-created_at'), many=True).data)

    def post(self, request):
        lead = apply_lead_input(CRMLead(assigned_to=request.user, status=LeadStage.LEAD), request.data)
        lead.save()
        log_audit(request.user, 'LEAD_CREATED', 'LEAD', lead.id, f'{lead.business_name} ({lead.contact_person})',
                  client_ip(request), target_name=lead.business_name, new_value=lead.status)
        return Response(CRMLeadSerializer(lead).data, status=status.HTTP_201_CREATED)


class CRMLeadDetailView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def put(self, request, pk):
        lead = get_lead(request, pk)
        old = lead.status
        apply_lead_input(lead, request.data)
        lead.save()
        log_audit(request.user, 'LEAD_UPDATED', 'LEAD', lead.id, lead.business_name, client_ip(request),
                  target_name=lead.business_name, old_value=old, new_value=lead.status)
        return Response(CRMLeadSerializer(lead).data)

    def delete(self, request, pk):
        lead = get_lead(request, pk)
        name = lead.business_name
        lead.delete()
        log_audit(request.user, 'LEAD_DELETED', 'LEAD', pk, name, client_ip(request), target_name=name)
        return Response({'success': True})


class CRMLeadStageUpdateView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def post(self, request, pk):
        lead = get_lead(request, pk)
        new_stage = request.data.get('status')
        if new_stage not in LeadStage.values:
            return error('Noto‘g‘ri CRM bosqichi.')
        old = lead.status
        lead.status = new_stage
        lead.save(update_fields=['status', 'updated_at'])
        log_audit(request.user, 'LEAD_STAGE_CHANGED', 'LEAD', lead.id, f'{old} -> {new_stage}', client_ip(request),
                  target_name=lead.business_name, old_value=old, new_value=new_stage)
        return Response(CRMLeadSerializer(lead).data)


def generated_owner_email(business_name):
    base = re.sub(r'[^a-z0-9]+', '', slugify(business_name))[:30] or 'biznes'
    while True:
        email = f'{base}_{secrets.randbelow(9000) + 1000}@navbatbor.uz'
        if not User.objects.filter(email=email).exists():
            return email


class CRMLeadConvertView(views.APIView):
    """Convert a lead into a live business + owner account.

    If `owner_password` is empty a strong temporary password is generated and
    returned once as `owner_temp_password`.
    """
    permission_classes = [IsOperatingPartner]

    def post(self, request, pk):
        lead = get_lead(request, pk)
        if lead.converted_business_id:
            return error('Bu lead allaqachon biznesga aylantirilgan.')
        plan_code = str(request.data.get('plan_code') or '').upper()
        category = (Category.objects.filter(Q(name__iexact=lead.category) | Q(slug=slugify(lead.category or ''))).first()
                    or Category.objects.filter(id='cat-other').first() or Category.objects.order_by('name').first())
        city = City.objects.filter(name__iexact=lead.city).first() or City.objects.filter(id='city-qarshi').first() \
            or City.objects.order_by('name').first()
        if not category or not city:
            return error('Kategoriya yoki shahar ma’lumotlari topilmadi.')

        email = generated_owner_email(lead.business_name)
        with transaction.atomic():
            password, generated = resolve_owner_password(request.data.get('owner_password'),
                                                         User(email=email, name=lead.contact_person))
            owner = User.objects.create_user(
                email=email, password=password, name=lead.contact_person[:255], phone=lead.phone[:32] or None,
                role=UserRole.BUSINESS_OWNER, status=UserStatus.ACTIVE,
                telegram_username=lead.telegram_username.lstrip('@') or None,
            )
            business = create_partner_business(
                partner=request.user, owner=owner, name=lead.business_name, category=category, city=city,
                address=lead.address or f'{city.name} shahri', phone=lead.phone,
                description=f'{lead.business_name} — NavbatBor hamkor muassasasi.',
            )
            tx = _maybe_request_plan(business, request.user, plan_code)
            old = lead.status
            lead.status = LeadStage.ACTIVE
            lead.converted_business = business
            lead.save(update_fields=['status', 'converted_business', 'updated_at'])

        log_audit(request.user, 'LEAD_CONVERTED_TO_BUSINESS', 'LEAD', lead.id, f'{lead.business_name} -> {business.id}',
                  client_ip(request), target_name=lead.business_name, old_value=old, new_value=LeadStage.ACTIVE)
        message = f'{lead.business_name} platformaga ulandi! Login: {email}'
        if generated:
            message += ' (vaqtinchalik parol quyida ko‘rsatilgan — egasiga xavfsiz topshiring)'
        return Response({
            'success': True,
            'business_id': business.id,
            'business_slug': business.slug,
            'business': partner_business_rows(Business.objects.filter(pk=business.pk))[0],
            'owner_login': email,
            'owner_temp_password': password if generated else None,
            'pending_transaction_id': tx.id if tx else None,
            'message': message,
        })


# ---------------------------------------------------------------------------
# Commissions
# ---------------------------------------------------------------------------
class PartnerCommissionsView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def get(self, request):
        qs = commissions_for(request.user).order_by('-created_at')
        return Response({'commissions': PartnerCommissionSerializer(qs, many=True).data, 'summary': commission_summary(qs)})


class PartnerCommissionSettleView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, pk):
        with transaction.atomic():
            comm = PartnerCommission.objects.select_for_update().select_related('business').filter(id=pk).first()
            if not comm:
                return error('Komissiya yozuvi topilmadi.', status.HTTP_404_NOT_FOUND)
            if comm.status != 'PENDING':
                return error('Bu komissiya allaqachon to‘langan yoki bekor qilingan.')
            comm.status = 'PAID'
            comm.paid_at = timezone.now()
            comm.payout_notes = (str(request.data.get('payout_notes') or '').strip() or 'Founder tomonidan to‘landi')[:2000]
            comm.save(update_fields=['status', 'paid_at', 'payout_notes'])
        log_audit(request.user, 'COMMISSION_PAID_BY_FOUNDER', 'COMMISSION', comm.id,
                  f'{comm.amount_uzs} so‘m ({comm.business.name})', client_ip(request), target_name=comm.business.name,
                  old_value='PENDING', new_value='PAID')
        return Response({'success': True, 'message': 'Komissiya to‘lovi muvaffaqiyatli tasdiqlandi',
                         'commission': PartnerCommissionSerializer(comm).data})


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
class PartnerReportsView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def get(self, request):
        qs = PartnerReport.objects.select_related('partner').order_by('-created_at')
        if not is_admin(request.user):
            qs = qs.filter(partner=request.user)
        return Response(PartnerReportSerializer(qs, many=True).data)

    def post(self, request):
        from apps.notifications.services import esc, send_telegram_message

        data = request.data
        report_type = str(data.get('report_type') or 'WEEKLY').upper()
        if report_type not in ('WEEKLY', 'MONTHLY'):
            return error('report_type WEEKLY yoki MONTHLY bo‘lishi kerak.')
        period_label = str(data.get('period_label') or '').strip()
        completed = str(data.get('completed_work') or data.get('content') or '').strip()
        if not period_label or not completed:
            return error('Davr va bajarilgan ishlar matnini to‘ldiring.')
        report = PartnerReport.objects.create(
            partner=request.user, report_type=report_type, period_label=period_label[:64],
            period_start=parse_date(data['period_start'], 'period_start') if data.get('period_start') else None,
            period_end=parse_date(data['period_end'], 'period_end') if data.get('period_end') else None,
            new_businesses_count=parse_int(data.get('new_businesses_count'), default=0, min_value=0, field='new_businesses_count'),
            total_businesses_count=parse_int(data.get('total_businesses_count'), default=0, min_value=0, field='total_businesses_count'),
            total_revenue_uzs=parse_int(data.get('total_revenue_uzs'), default=0, min_value=0, field='total_revenue_uzs'),
            partner_commission_uzs=parse_int(data.get('partner_commission_uzs'), default=0, min_value=0, field='partner_commission_uzs'),
            new_customers_count=parse_int(data.get('new_customers_count'), default=0, min_value=0, field='new_customers_count'),
            content=completed[:10000], issues_summary=str(data.get('issues_summary') or '')[:10000],
            next_week_plan=str(data.get('next_week_plan') or '')[:10000], status='SUBMITTED',
        )
        text = (
            f'📊 <b>Hamkor hisoboti ({"Haftalik" if report_type == "WEEKLY" else "Oylik"})</b>\n━━━━━━━━━━━━━━━━\n'
            f'📅 Davr: <b>{esc(report.period_label)}</b>\n👤 Mas’ul: <b>{esc(request.user.name)}</b>\n'
            f'🏢 Yangi bizneslar: <b>{report.new_businesses_count}</b>\n💰 Tushum: <b>{report.total_revenue_uzs:,} so‘m</b>\n'
            f'⚡️ <b>Bajarilgan ishlar:</b>\n{esc(report.content)}'
        )
        sent = False
        for chat_id in User.objects.filter(role__in=ADMIN_ROLES).exclude(telegram_chat_id__isnull=True).exclude(
                telegram_chat_id='').values_list('telegram_chat_id', flat=True):
            sent = send_telegram_message(chat_id, text) or sent
        if sent:
            report.telegram_sent = True
            report.save(update_fields=['telegram_sent'])
        log_audit(request.user, 'REPORT_SUBMITTED_TO_FOUNDER', 'REPORT', report.id, report.period_label, client_ip(request),
                  target_name=report.period_label)
        return Response(PartnerReportSerializer(report).data, status=status.HTTP_201_CREATED)


class PartnerReportDraftView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def post(self, request):
        report_type = str(request.data.get('report_type') or 'WEEKLY').upper()
        days = 7 if report_type == 'WEEKLY' else 30
        end = local_today()
        start = end - timedelta(days=days)
        revenue = analytics.payment_revenue(since=start)
        label = f'{"Haftalik" if report_type == "WEEKLY" else "Oylik"}: {start.isoformat()} — {end.isoformat()}'
        return Response({
            'report_type': report_type,
            'period_label': label,
            'period_start': start.isoformat(),
            'period_end': end.isoformat(),
            'new_businesses_count': Business.objects.filter(created_at__date__gte=start).count(),
            'total_businesses_count': Business.objects.count(),
            'total_revenue_uzs': revenue,
            'partner_commission_uzs': round(revenue * 0.30),
            'new_customers_count': User.objects.filter(role=UserRole.CUSTOMER, created_at__date__gte=start).count(),
            'completed_work': '',
            'issues_summary': '',
            'next_week_plan': '',
        })


class PartnerReportReviewView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, pk):
        report = PartnerReport.objects.filter(id=pk).first()
        if not report:
            return error('Hisobot topilmadi.', status.HTTP_404_NOT_FOUND)
        report.founder_feedback = (str(request.data.get('founder_feedback') or '').strip()
                                   or 'Hisobot qabul qilindi va tasdiqlandi.')[:5000]
        report.status = 'REVIEWED'
        report.reviewed_at = timezone.now()
        report.save(update_fields=['founder_feedback', 'status', 'reviewed_at'])
        log_audit(request.user, 'REPORT_REVIEWED_BY_FOUNDER', 'REPORT', report.id, report.founder_feedback[:200],
                  client_ip(request), target_name=report.period_label)
        return Response({'success': True, 'message': 'Hisobot tasdiqlandi', 'report': PartnerReportSerializer(report).data})


# ---------------------------------------------------------------------------
# Audit & team
# ---------------------------------------------------------------------------
class PartnerAuditLogsView(views.APIView):
    permission_classes = [IsOperatingPartner]

    def get(self, request):
        qs = audit_logs_for(request.user)
        action = request.query_params.get('action', '').strip()
        target_type = request.query_params.get('target_type', '').strip()
        if action:
            qs = qs.filter(action__icontains=action)
        if target_type:
            qs = qs.filter(entity=target_type)
        return Response([log.as_dict() for log in qs.order_by('-created_at')[:100]])


class PartnerTeamUsersView(views.APIView):
    """Admins and the operating partner see full contact details; other partner staff see names/roles only."""
    permission_classes = [IsOperatingPartner]

    def get(self, request):
        users = User.objects.filter(role__in=TEAM_ROLES).order_by('-created_at')
        if has_role(request.user, (*ADMIN_ROLES, UserRole.OPERATING_PARTNER)):
            return Response(UserSerializer(users, many=True).data)
        return Response(PublicTeamMemberSerializer(users, many=True).data)
