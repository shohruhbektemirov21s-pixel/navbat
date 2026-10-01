"""Uniform API error format: every error response carries a human readable `error` string."""
import logging

from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed, MethodNotAllowed, NotAuthenticated, NotFound, PermissionDenied, Throttled,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger('apps.core')

DEFAULT_MESSAGES = {
    NotAuthenticated: 'Tizimga kirishingiz kerak.',
    AuthenticationFailed: 'Sessiya muddati tugagan yoki token yaroqsiz. Qaytadan kiring.',
    PermissionDenied: 'Ruxsat berilmagan.',
    NotFound: 'Topilmadi.',
    MethodNotAllowed: 'Ushbu so‘rov turi qo‘llab-quvvatlanmaydi.',
}


def _first_message(detail):
    """Flatten DRF error details into a single readable string."""
    if isinstance(detail, dict):
        if 'error' in detail:
            return _first_message(detail['error'])
        for key, value in detail.items():
            msg = _first_message(value)
            if msg:
                return msg if key in ('non_field_errors', 'detail') else f'{key}: {msg}'
        return ''
    if isinstance(detail, (list, tuple)):
        for item in detail:
            msg = _first_message(item)
            if msg:
                return msg
        return ''
    return str(detail)


def api_exception_handler(exc, context):
    if isinstance(exc, IntegrityError):
        logger.warning('integrity_error view=%s err=%s', context.get('view').__class__.__name__, exc)
        return Response({'error': 'Ma’lumotlar ziddiyati: bu amal allaqachon bajarilgan yoki band.'},
                        status=status.HTTP_409_CONFLICT)

    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, Throttled):
        wait = int(exc.wait or 0)
        message = f'Juda ko‘p urinish. {wait} soniyadan so‘ng qayta urinib ko‘ring.' if wait else 'Juda ko‘p urinish.'
    else:
        message = _first_message(getattr(exc, 'detail', '')) or ''
        for exc_type, default in DEFAULT_MESSAGES.items():
            if isinstance(exc, exc_type) and (not message or message == str(exc_type.default_detail)):
                message = default
                break
    response.data = {'error': message or 'So‘rovni bajarishda xatolik yuz berdi.'}
    return response
