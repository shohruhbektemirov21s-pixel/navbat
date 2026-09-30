import uuid
from django.db import models
from django.utils import timezone
from apps.authentication.models import User


class BusinessStatus(models.TextChoices):
    PENDING = 'PENDING', 'Kutilmoqda'
    APPROVED = 'APPROVED', 'Tasdiqlangan'
    REJECTED = 'REJECTED', 'Rad etilgan'
    SUSPENDED = 'SUSPENDED', 'To‘xtatilgan'


class Category(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    name = models.CharField(max_length=128, unique=True)
    slug = models.SlugField(max_length=128, unique=True)
    icon = models.CharField(max_length=64, blank=True, default='Grid')
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"cat-{self.slug}"
        super().save(*args, **kwargs)


class City(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    name = models.CharField(max_length=128, unique=True)
    region = models.CharField(max_length=128)

    class Meta:
        db_table = 'cities'
        verbose_name_plural = 'Cities'

    def __str__(self):
        return f"{self.name} ({self.region})"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"city-{self.name.lower().replace(' ', '-')}"
        super().save(*args, **kwargs)


class Business(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_businesses')
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='businesses')
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name='businesses')
    district = models.CharField(max_length=128, blank=True)
    address = models.CharField(max_length=255)
    phone = models.CharField(max_length=32)
    description = models.TextField(blank=True)
    logo_url = models.URLField(max_length=500, blank=True)
    status = models.CharField(
        max_length=32,
        choices=BusinessStatus.choices,
        default=BusinessStatus.APPROVED,
        db_index=True
    )
    is_verified = models.BooleanField(default=True)
    is_sponsored = models.BooleanField(default=False)
    subscription_plan_code = models.CharField(max_length=32, default='PRO')
    subscription_expires_at = models.DateTimeField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    telegram_channel_or_group = models.CharField(max_length=128, blank=True)
    telegram_chat_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'businesses'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.city.name}"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"biz-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class Service(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price_uzs = models.IntegerField(default=0)
    duration_minutes = models.IntegerField(default=30)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'services'

    def __str__(self):
        return f"{self.name} ({self.price_uzs:,} so'm)"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"srv-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class Staff(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='staff')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_profiles')
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=128)
    phone = models.CharField(max_length=32, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    services = models.ManyToManyField(Service, blank=True, related_name='staff_members')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'staff'

    def __str__(self):
        return f"{self.name} ({self.title})"

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"stf-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class BusinessHours(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='hours')
    day_of_week = models.IntegerField()  # 0=Monday, 6=Sunday
    open_time = models.CharField(max_length=10, default='09:00')
    close_time = models.CharField(max_length=10, default='18:00')
    is_closed = models.BooleanField(default=False)
    break_start = models.CharField(max_length=10, blank=True, default='')
    break_end = models.CharField(max_length=10, blank=True, default='')

    class Meta:
        db_table = 'business_hours'
        unique_together = ('business', 'day_of_week')


class Review(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='reviews')
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    rating = models.IntegerField(default=5)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = f"rev-{uuid.uuid4().hex[:12]}"
        super().save(*args, **kwargs)


class SavedBusiness(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_businesses')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='saved_by_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'saved_businesses'
        unique_together = ('user', 'business')
