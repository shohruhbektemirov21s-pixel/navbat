"""
Django settings for the NavbatBor backend.

All environment specific values are read from environment variables (a root
`.env` file is loaded for local development). See `.env.example` for the full
list of supported variables.
"""
import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlparse

import dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# Root .env (repo root) first, then an optional backend/.env. Real environment
# variables always win because load_dotenv does not override by default.
dotenv.load_dotenv(BASE_DIR.parent / '.env')
dotenv.load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None or value.strip() == '':
        return default
    return value.strip().lower() in ('1', 'true', 't', 'yes', 'y', 'on')


def env_list(name, default=''):
    raw = os.getenv(name, default) or ''
    return [item.strip() for item in raw.split(',') if item.strip()]


def env_int(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Core security
# ---------------------------------------------------------------------------
DEBUG = env_bool('DJANGO_DEBUG', False)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '').strip()
if not SECRET_KEY:
    if DEBUG:
        # Development only: an ephemeral key (tokens are invalidated on restart).
        SECRET_KEY = 'dev-insecure-' + os.urandom(32).hex()
    else:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY muhit o‘zgaruvchisi o‘rnatilmagan (DEBUG=False).')

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1' if DEBUG else '')
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    # Domain apps
    'apps.authentication',
    'apps.core',
    'apps.marketplace',
    'apps.bookings',
    'apps.queues',
    'apps.partners',
    'apps.subscriptions',
    'apps.support',
    'apps.notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'navbat_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'navbat_backend.wsgi.application'


# ---------------------------------------------------------------------------
# Database: DATABASE_URL (postgres://user:pass@host:5432/db) or SQLite fallback
# ---------------------------------------------------------------------------
def database_from_url(url):
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    options = dict(parse_qsl(parsed.query))
    if scheme in ('postgres', 'postgresql', 'pgsql'):
        return {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': unquote(parsed.path.lstrip('/')),
            'USER': unquote(parsed.username or ''),
            'PASSWORD': unquote(parsed.password or ''),
            'HOST': parsed.hostname or '',
            'PORT': str(parsed.port or ''),
            'CONN_MAX_AGE': env_int('DB_CONN_MAX_AGE', 60),
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': options,
        }
    if scheme == 'sqlite':
        path = unquote(parsed.path) or str(BASE_DIR / 'navbatbor.sqlite3')
        return {'ENGINE': 'django.db.backends.sqlite3', 'NAME': path, 'OPTIONS': {'timeout': 20}}
    raise ImproperlyConfigured(f'DATABASE_URL sxemasi qo‘llab-quvvatlanmaydi: {scheme}')


DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
if DATABASE_URL:
    DATABASES = {'default': database_from_url(DATABASE_URL)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'navbatbor.sqlite3',
            'OPTIONS': {'timeout': 20},
        }
    }

AUTH_USER_MODEL = 'authentication.User'

PASSWORD_MIN_LENGTH = 8
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': PASSWORD_MIN_LENGTH}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------------
# Internationalization & time zone (Uzbekistan, UTC+5)
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'uz'
TIME_ZONE = 'Asia/Tashkent'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & media
# ---------------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {
        'BACKEND': (
            'django.contrib.staticfiles.storage.StaticFilesStorage' if DEBUG
            else 'whitenoise.storage.CompressedManifestStaticFilesStorage'
        ),
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
_renderers = ['rest_framework.renderers.JSONRenderer']
if DEBUG:
    _renderers.append('rest_framework.renderers.BrowsableAPIRenderer')

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.authentication.authentication.ActiveUserJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_RENDERER_CLASSES': tuple(_renderers),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.getenv('THROTTLE_ANON', '300/min'),
        'user': os.getenv('THROTTLE_USER', '1200/min'),
        # Credential endpoints: login, register, quick-login, telegram-session create.
        'auth': os.getenv('THROTTLE_AUTH', '10/min'),
        # Telegram session status polling (frontend polls every ~1.5s).
        'auth_poll': os.getenv('THROTTLE_AUTH_POLL', '60/min'),
    },
    'NUM_PROXIES': env_int('NUM_PROXIES', 0) or None,
    'EXCEPTION_HANDLER': 'apps.core.exceptions.api_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=env_int('JWT_ACCESS_MINUTES', 30)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=env_int('JWT_REFRESH_DAYS', 7)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = DEBUG and env_bool('CORS_ALLOW_ALL_ORIGINS', False)
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', 'http://localhost:3000' if DEBUG else '')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# ---------------------------------------------------------------------------
# Production hardening (only when DEBUG is off)
# ---------------------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', True)
    SECURE_HSTS_SECONDS = env_int('SECURE_HSTS_SECONDS', 31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', True)
    SECURE_HSTS_PRELOAD = env_bool('SECURE_HSTS_PRELOAD', True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    X_FRAME_OPTIONS = 'DENY'

# ---------------------------------------------------------------------------
# Logging (console, key=value style so it is grep/aggregator friendly)
# ---------------------------------------------------------------------------
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'structured': {
            'format': 'ts=%(asctime)s level=%(levelname)s logger=%(name)s msg="%(message)s"',
        },
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'structured'},
    },
    'root': {'handlers': ['console'], 'level': LOG_LEVEL},
    'loggers': {
        'django': {'handlers': ['console'], 'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'), 'propagate': False},
        'django.db.backends': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'apps': {'handlers': ['console'], 'level': LOG_LEVEL, 'propagate': False},
    },
}

# ---------------------------------------------------------------------------
# Telegram & app integration
# ---------------------------------------------------------------------------
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '').strip()
TELEGRAM_BOT_USERNAME = os.getenv('TELEGRAM_BOT_USERNAME', 'NavbatBor_bot').strip() or 'NavbatBor_bot'
TELEGRAM_ADMIN_CHAT_ID = os.getenv('TELEGRAM_ADMIN_CHAT_ID', '').strip()
TELEGRAM_ADMIN_BOT_TOKEN = os.getenv('TELEGRAM_ADMIN_BOT_TOKEN', '').strip()
TELEGRAM_ADMIN_USER_IDS = env_list('TELEGRAM_ADMIN_USER_IDS')
TELEGRAM_ADMIN_REVIEWER_EMAIL = os.getenv('TELEGRAM_ADMIN_REVIEWER_EMAIL', 'rasulovjahongir074@gmail.com').strip()
TELEGRAM_WEBHOOK_SECRET = os.getenv('TELEGRAM_WEBHOOK_SECRET', '').strip()
TELEGRAM_PAYMENT_CONTACT_URL = os.getenv('TELEGRAM_PAYMENT_CONTACT_URL', 'https://t.me/mansur_0511').strip()
# Max age of Telegram WebApp initData (seconds).
TELEGRAM_INITDATA_MAX_AGE = env_int('TELEGRAM_INITDATA_MAX_AGE', 24 * 3600)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
# Base URL this Django process is reachable at — used to build absolute media URLs
# (business application photos, logos) that are sent over Telegram and the admin API.
BACKEND_URL = os.getenv('BACKEND_URL', os.getenv('SITE_URL', 'http://127.0.0.1:8000')).rstrip('/')

# Development-only escape hatch: phone-only Telegram "quick login" for CUSTOMER
# accounts. Honoured only when DEBUG is also on.
ALLOW_DEV_QUICK_LOGIN = DEBUG and env_bool('ALLOW_DEV_QUICK_LOGIN', False)
