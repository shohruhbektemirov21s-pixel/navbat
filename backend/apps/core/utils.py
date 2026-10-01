"""Small, dependency-free helpers shared by all apps."""
import re
from datetime import date, datetime

from django.utils import timezone
from rest_framework.exceptions import ValidationError

HHMM_RE = re.compile(r'^([01]\d|2[0-3]):([0-5]\d)$')


def local_now():
    """Current time in the project time zone (Asia/Tashkent)."""
    return timezone.localtime(timezone.now())


def local_today():
    return timezone.localdate()


def parse_int(value, *, default=None, min_value=None, max_value=None, field='qiymat'):
    """Parse an int from query/body input; raise a 400 with an Uzbek message on bad input."""
    if value is None or (isinstance(value, str) and value.strip() == ''):
        if default is None:
            raise ValidationError({'error': f"'{field}' kiritilishi shart."})
        return default
    try:
        result = int(str(value).strip())
    except (TypeError, ValueError):
        raise ValidationError({'error': f"'{field}' butun son bo‘lishi kerak."})
    if min_value is not None and result < min_value:
        raise ValidationError({'error': f"'{field}' kamida {min_value} bo‘lishi kerak."})
    if max_value is not None and result > max_value:
        raise ValidationError({'error': f"'{field}' ko‘pi bilan {max_value} bo‘lishi kerak."})
    return result


def parse_pagination(params, default_limit=20, max_limit=100):
    page = parse_int(params.get('page'), default=1, min_value=1, field='page')
    limit = parse_int(params.get('limit'), default=default_limit, min_value=1, max_value=max_limit, field='limit')
    return page, limit


def parse_float(value, field='qiymat'):
    if value is None or str(value).strip() == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValidationError({'error': f"'{field}' son bo‘lishi kerak."})


def parse_hhmm(value, field='vaqt'):
    """Validate an 'HH:MM' string and return it normalised."""
    if not isinstance(value, str) or not HHMM_RE.match(value.strip()):
        raise ValidationError({'error': f"'{field}' HH:MM formatida bo‘lishi kerak (masalan 09:30)."})
    return value.strip()


def parse_date(value, field='sana'):
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if not value or not isinstance(value, str):
        raise ValidationError({'error': f"'{field}' kiritilishi shart (YYYY-MM-DD)."})
    try:
        return datetime.strptime(value.strip(), '%Y-%m-%d').date()
    except ValueError:
        raise ValidationError({'error': f"'{field}' YYYY-MM-DD formatida bo‘lishi kerak."})


def hhmm_to_minutes(value):
    """'09:30' -> 570. Returns None for empty/invalid values (lenient, for stored data)."""
    if not value or not isinstance(value, str):
        return None
    match = HHMM_RE.match(value.strip()[:5])
    if not match:
        return None
    return int(match.group(1)) * 60 + int(match.group(2))


def minutes_to_hhmm(minutes):
    minutes = max(0, int(minutes))
    return f'{minutes // 60:02d}:{minutes % 60:02d}'


def js_weekday(day):
    """Weekday in the frontend/JavaScript convention: 0=Sunday ... 6=Saturday."""
    return (day.weekday() + 1) % 7


def client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()[:45]
    return (request.META.get('REMOTE_ADDR') or '')[:45]


def month_start(day=None):
    day = day or local_today()
    return day.replace(day=1)
