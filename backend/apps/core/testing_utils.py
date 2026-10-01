"""Shared factory helpers for the test suite (not a test module itself).

Kept out of the `test*.py` discovery pattern's "interesting" set by containing no
TestCase subclasses; Django's runner may still import it but will find nothing to run.
"""
import itertools

from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.authentication.models import User, UserRole, UserStatus
from apps.marketplace.models import Business, BusinessStatus, Category, City, Service, Staff
from apps.subscriptions.models import SubscriptionPlan

_counter = itertools.count(1)

STRONG_PASSWORD = 'Kj8#mZq2Wp!91xT'


def unique_suffix():
    return next(_counter)


def make_user(role=UserRole.CUSTOMER, *, email=None, password=STRONG_PASSWORD, name=None,
              status=UserStatus.ACTIVE, is_active=True, **extra):
    n = unique_suffix()
    email = email or f'user{n}@example.test'
    name = name or f'Test User {n}'
    user = User.objects.create_user(email=email, password=password, name=name, role=role, status=status, **extra)
    if not is_active:
        user.is_active = False
        user.save(update_fields=['is_active'])
    return user


def make_category(**extra):
    n = unique_suffix()
    defaults = {'name': f'Category {n}', 'slug': f'category-{n}', 'icon': 'Grid', 'description': '', 'active': True}
    defaults.update(extra)
    return Category.objects.create(**defaults)


def make_city(**extra):
    n = unique_suffix()
    defaults = {'name': f'City {n}', 'region': 'Test region'}
    defaults.update(extra)
    return City.objects.create(**defaults)


def make_business(owner, *, category=None, city=None, status=BusinessStatus.APPROVED, **extra):
    n = unique_suffix()
    category = category or make_category()
    city = city or make_city()
    defaults = {
        'name': f'Business {n}',
        'slug': f'business-{n}',
        'category': category,
        'city': city,
        'address': f'Test address {n}',
        'phone': f'+99890000{n:04d}',
        'status': status,
        'is_verified': status == BusinessStatus.APPROVED,
        'subscription_plan_code': 'PRO',
    }
    defaults.update(extra)
    return Business.objects.create(owner=owner, **defaults)


def make_service(business, **extra):
    n = unique_suffix()
    defaults = {'name': f'Service {n}', 'price_uzs': 50000, 'duration_minutes': 30, 'is_active': True}
    defaults.update(extra)
    return Service.objects.create(business=business, **defaults)


def make_staff(business, **extra):
    n = unique_suffix()
    defaults = {'name': f'Staff {n}', 'title': 'Mutaxassis', 'is_active': True}
    defaults.update(extra)
    staff = Staff.objects.create(business=business, **defaults)
    if 'services' not in extra:
        staff.services.set(business.services.all())
    return staff


def make_plan(code, price_uzs=100000, **extra):
    defaults = {'name': code.title(), 'price_uzs': price_uzs, 'max_staff': 10, 'max_monthly_bookings': 1000}
    defaults.update(extra)
    plan, _ = SubscriptionPlan.objects.update_or_create(code=code, defaults=defaults)
    return plan


def auth_headers(client, email, password=STRONG_PASSWORD):
    """Log in via the real endpoint and return (tokens_dict, auth_header_dict)."""
    response = client.post('/api/auth/login', {'email': email, 'password': password}, format='json')
    assert response.status_code == 200, response.content
    data = response.json()
    return data, {'HTTP_AUTHORIZATION': f"Bearer {data['token']}"}


def login_as(client, user, password=STRONG_PASSWORD):
    """Log in via the real endpoint and set the Authorization header on `client` for subsequent calls."""
    data, headers = auth_headers(client, user.email, password)
    client.credentials(HTTP_AUTHORIZATION=headers['HTTP_AUTHORIZATION'])
    return data


class BaseAPITestCase(APITestCase):
    """Clears the (process-shared) throttle cache before every test so unrelated tests
    never trip each other's `auth`/`anon`/`user` scope rate limits."""

    def setUp(self):
        super().setUp()
        cache.clear()
