"""Business access control: the single place that decides which business a user may manage."""
import secrets

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.authentication.models import User, UserRole, UserStatus

from .models import Business, BusinessHours, BusinessStatus, Staff
from .application_models import BusinessApplicationStatus

ADMIN_ROLES = (UserRole.FOUNDER, UserRole.ADMIN)

NO_BUSINESS_MSG = 'Sizga biriktirilgan biznes topilmadi.'
FORBIDDEN_MSG = 'Ushbu biznesni boshqarishga ruxsatingiz yo‘q.'
OWNER_ONLY_MSG = 'Bu amalni faqat biznes egasi bajarishi mumkin.'


def is_admin(user):
    return bool(user and user.is_authenticated and user.role in ADMIN_ROLES)


def is_business_owner(user, business):
    return bool(user and user.is_authenticated and business.owner_id == user.id)


def is_business_staff(user, business):
    return bool(
        user and user.is_authenticated
        and Staff.objects.filter(business=business, user=user, is_active=True).exists()
    )


def can_manage_business(user, business, *, owner_only=False):
    """Owner (or platform admin) always; active staff members unless `owner_only`."""
    if is_admin(user) or is_business_owner(user, business):
        return True
    if owner_only:
        return False
    return is_business_staff(user, business)


def get_user_business(user, business_id=None, *, owner_only=False):
    """Return the business `user` may manage.

    * With `business_id`: that business if the user owns it / is its staff / is an admin,
      otherwise PermissionDenied (NotFound if it does not exist).
    * Without: the user's own business (oldest first), else the business they are staff of,
      otherwise NotFound. Never falls back to somebody else's business.
    """
    if not user or not user.is_authenticated:
        raise PermissionDenied(FORBIDDEN_MSG)

    if business_id:
        business = Business.objects.select_related('owner', 'category', 'city').filter(
            Q(id=business_id) | Q(slug=business_id)
        ).first()
        if not business:
            raise NotFound('Biznes topilmadi.')
        if not can_manage_business(user, business, owner_only=owner_only):
            raise PermissionDenied(OWNER_ONLY_MSG if owner_only and is_business_staff(user, business) else FORBIDDEN_MSG)
        return business

    business = (
        Business.objects.select_related('owner', 'category', 'city')
        .filter(owner=user).order_by('created_at').first()
    )
    if business:
        return business

    membership = (
        Staff.objects.select_related('business__owner', 'business__category', 'business__city')
        .filter(user=user, is_active=True).order_by('created_at').first()
    )
    if membership:
        if owner_only:
            raise PermissionDenied(OWNER_ONLY_MSG)
        return membership.business
    raise NotFound(NO_BUSINESS_MSG)


def find_user_business(user):
    """Like get_user_business() but returns None instead of raising."""
    try:
        return get_user_business(user)
    except (NotFound, PermissionDenied):
        return None


def unique_business_slug(name, exclude_id=None):
    base = slugify(name)[:230] or 'biznes'
    slug, counter = base, 2
    qs = Business.objects.all()
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    while qs.filter(slug=slug).exists():
        slug = f'{base}-{counter}'
        counter += 1
    return slug


# ---------------------------------------------------------------------------
# Telegram-bot business application -> real Business (approve / reject)
# ---------------------------------------------------------------------------
def _applicant_user(application):
    """Find-or-create the User who will own the resulting Business."""
    if application.applicant_id:
        return application.applicant
    if application.telegram_chat_id:
        existing = User.objects.filter(telegram_chat_id=application.telegram_chat_id).first()
        if existing:
            return existing

    chat_part = application.telegram_chat_id or secrets.token_hex(6)
    email = f'tg{chat_part}@telegram.navbatbor.uz'
    suffix = 2
    while User.objects.filter(email__iexact=email).exists():
        email = f'tg{chat_part}_{suffix}@telegram.navbatbor.uz'
        suffix += 1
    return User.objects.create_user(
        email=email,
        password=secrets.token_urlsafe(18),
        name=(application.name or 'Biznes egasi')[:255],
        phone=(application.phone or '')[:32] or None,
        role=UserRole.BUSINESS_OWNER,
        status=UserStatus.ACTIVE,
        telegram_chat_id=application.telegram_chat_id or None,
        telegram_username=application.telegram_username or None,
    )


def approve_business_application(application, reviewed_by):
    """Create the real Business + BusinessHours from an approved application.

    Shared by the Telegram bot (inline "Tasdiqlash" button) and the admin HTTP endpoint —
    exactly one code path, so both stay in sync. Raises ValueError (caller -> 400) if the
    application is missing required fields (should not happen once the bot flow is complete).
    """
    from apps.notifications.services import esc, send_telegram_message

    if not application.name or not application.category_id or not application.city_id \
            or not application.address or not application.phone:
        raise ValueError('Ariza to‘liq emas: nomi, soha, shahar, manzil va telefon kiritilishi shart.')

    user = _applicant_user(application)
    # Never silently downgrade an account that already outranks BUSINESS_OWNER (e.g. an
    # ADMIN testing the flow) — only promote plain customers/newly created accounts.
    if user.role == UserRole.CUSTOMER:
        user.role = UserRole.BUSINESS_OWNER
        user.save(update_fields=['role'])

    first_photo = application.photos.order_by('order', 'created_at').first()
    logo_url = ''
    if first_photo and first_photo.image:
        logo_url = f'{settings.BACKEND_URL}{first_photo.image.url}'[:500]

    with transaction.atomic():
        business = Business.objects.create(
            owner=user,
            name=application.name[:255],
            slug=unique_business_slug(application.name),
            category=application.category,
            city=application.city,
            district=(application.district or '')[:128],
            address=application.address[:255],
            phone=application.phone[:32],
            description=(application.description or '')[:5000],
            logo_url=logo_url,
            status=BusinessStatus.APPROVED,
            is_verified=True,
            telegram_chat_id=application.telegram_chat_id or '',
        )
        for hour in application.hours.all():
            BusinessHours.objects.create(
                business=business, day_of_week=hour.day_of_week, open_time=hour.open_time,
                close_time=hour.close_time, is_closed=hour.is_closed,
                break_start=hour.break_start, break_end=hour.break_end,
            )
        application.status = BusinessApplicationStatus.APPROVED
        application.reviewed_by = reviewed_by
        application.reviewed_at = timezone.now()
        application.resulting_business = business
        application.awaiting_reject_from = ''
        application.save(update_fields=[
            'status', 'reviewed_by', 'reviewed_at', 'resulting_business', 'awaiting_reject_from', 'updated_at',
        ])

    if application.telegram_chat_id:
        send_telegram_message(application.telegram_chat_id, (
            '🎉 <b>Tabriklaymiz! Biznesingiz tasdiqlandi</b>\n━━━━━━━━━━━━━━━━\n'
            f'🏢 <b>{esc(business.name)}</b> endi NavbatBor katalogida ko‘rinadi.\n'
            f'🔗 {settings.FRONTEND_URL}/b/{business.slug}'
        ))
    from apps.notifications.services import notify_user
    notify_user(application.applicant, 'Biznesingiz tasdiqlandi', f'{business.name} katalogga qo‘shildi.', 'SUCCESS')
    return business


def reject_business_application(application, reviewed_by, reason):
    """Mark an application REJECTED and notify the applicant (reason is HTML-escaped)."""
    from apps.notifications.services import esc, send_telegram_message

    application.status = BusinessApplicationStatus.REJECTED
    application.reject_reason = (reason or '').strip()[:2000]
    application.reviewed_by = reviewed_by
    application.reviewed_at = timezone.now()
    application.awaiting_reject_from = ''
    application.save(update_fields=[
        'status', 'reject_reason', 'reviewed_by', 'reviewed_at', 'awaiting_reject_from', 'updated_at',
    ])
    if application.telegram_chat_id:
        send_telegram_message(application.telegram_chat_id, (
            '😔 <b>Ariza rad etildi</b>\n━━━━━━━━━━━━━━━━\n'
            f'🏢 <b>{esc(application.name)}</b> arizangiz tasdiqlanmadi.\n'
            f'<b>Sabab:</b> {esc(application.reject_reason)}\n\n'
            'Qayta ariza topshirish uchun botga /start bizapp buyrug‘ini yuboring.'
        ))
    from apps.notifications.services import notify_user
    notify_user(application.applicant, 'Biznes arizasi rad etildi', application.reject_reason, 'WARNING')
    return application
