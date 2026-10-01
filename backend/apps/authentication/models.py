import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone


class UserRole(models.TextChoices):
    FOUNDER = 'FOUNDER', 'Founder'
    ADMIN = 'ADMIN', 'Admin'
    OPERATING_PARTNER = 'OPERATING_PARTNER', 'Operating Partner'
    SALES_MANAGER = 'SALES_MANAGER', 'Sales Manager'
    BUSINESS_MANAGER = 'BUSINESS_MANAGER', 'Business Manager'
    SUPPORT = 'SUPPORT', 'Support'
    BUSINESS_OWNER = 'BUSINESS_OWNER', 'Business Owner'
    STAFF = 'STAFF', 'Staff'
    EMPLOYEE = 'EMPLOYEE', 'Employee'
    CUSTOMER = 'CUSTOMER', 'Customer'


class UserStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Faol'
    SUSPENDED = 'SUSPENDED', 'To‘xtatilgan'
    PENDING_VERIFICATION = 'PENDING_VERIFICATION', 'Tasdiqlash kutilmoqda'


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email kiritilishi shart.')
        email = self.normalize_email(email)
        if 'id' not in extra_fields or not extra_fields['id']:
            extra_fields['id'] = f"usr-{uuid.uuid4().hex[:12]}"
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', UserRole.FOUNDER)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('status', UserStatus.ACTIVE)
        if 'name' not in extra_fields:
            extra_fields['name'] = 'Super Admin'
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    name = models.CharField(max_length=255, verbose_name="F.I.SH")
    email = models.EmailField(unique=True, db_index=True, verbose_name="Elektron pochta")
    phone = models.CharField(max_length=32, blank=True, null=True, verbose_name="Telefon")
    role = models.CharField(
        max_length=32,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER,
        db_index=True,
        verbose_name="Rol"
    )
    status = models.CharField(
        max_length=32,
        choices=UserStatus.choices,
        default=UserStatus.ACTIVE,
        db_index=True,
        verbose_name="Holat"
    )
    telegram_chat_id = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    telegram_username = models.CharField(max_length=128, blank=True, null=True)
    telegram_notifications_enabled = models.BooleanField(default=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'auth_users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.email}) - {self.role}"

    @property
    def is_founder(self):
        """True for platform administrators (FOUNDER or ADMIN)."""
        return self.role in [UserRole.FOUNDER, UserRole.ADMIN]

    @property
    def is_partner(self):
        return self.role == UserRole.OPERATING_PARTNER

    @property
    def is_biz_owner(self):
        return self.role in [UserRole.BUSINESS_OWNER, UserRole.FOUNDER, UserRole.ADMIN]


class TelegramLinkToken(models.Model):
    token = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='telegram_tokens')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = 'telegram_link_tokens'


class TelegramAuthSession(models.Model):
    """Browser login session confirmed by the Telegram bot (`/start auth_<session_id>` or the 6-digit code)."""
    session_id = models.CharField(max_length=64, unique=True, db_index=True)
    code = models.CharField(max_length=16, db_index=True)
    status = models.CharField(max_length=20, default='PENDING')  # PENDING, CONFIRMED, CONSUMED, EXPIRED
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    # Legacy column, no longer populated: tokens are minted on demand, never stored.
    token = models.TextField(blank=True, null=True)
    telegram_chat_id = models.CharField(max_length=64, blank=True, default='')
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'telegram_auth_sessions'
