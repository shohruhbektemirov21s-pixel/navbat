"""Authenticated website applications; approval belongs to the private owner bot."""
import logging

from django.db import transaction
from rest_framework import permissions, serializers, status, views
from rest_framework.response import Response

from apps.authentication.models import User
from apps.notifications.admin_bot import notify_owner
from .models import (
    BusinessApplication, BusinessApplicationHours, BusinessApplicationPhoto,
    BusinessApplicationStatus, BusinessApplicationStep, Category, City,
)

logger = logging.getLogger('apps.marketplace')


class ApplicationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.filter(active=True))
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all())
    address = serializers.CharField(max_length=255)
    phone = serializers.RegexField(r'^\+998\d{9}$', error_messages={'invalid': 'Telefon +998XXXXXXXXX shaklida bo‘lishi kerak.'})
    description = serializers.CharField(max_length=5000, required=False, allow_blank=True)
    open_time = serializers.TimeField(format='%H:%M', input_formats=['%H:%M'])
    close_time = serializers.TimeField(format='%H:%M', input_formats=['%H:%M'])
    working_days = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=6), min_length=1, max_length=7)
    photos = serializers.ListField(child=serializers.ImageField(), min_length=1, max_length=6)

    def validate_photos(self, photos):
        for photo in photos:
            if photo.size > 5 * 1024 * 1024:
                raise serializers.ValidationError('Har bir rasm 5 MB dan kichik bo‘lishi kerak.')
            if photo.image.format not in ('JPEG', 'PNG', 'WEBP'):
                raise serializers.ValidationError('JPG, PNG yoki WebP rasmini tanlang.')
        return photos

    def validate(self, data):
        if data['open_time'] >= data['close_time']:
            raise serializers.ValidationError('Yopilish vaqti ochilish vaqtidan keyin bo‘lishi kerak.')
        if len(set(data['working_days'])) != len(data['working_days']):
            raise serializers.ValidationError('Ish kunlari takrorlanmasligi kerak.')
        return data


def payload(application):
    return {'id': application.id, 'name': application.name, 'status': application.status,
            'rejectReason': application.reject_reason,
            'businessSlug': application.resulting_business.slug if application.resulting_business_id else None}


class BusinessApplicationSubmitView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response([payload(app) for app in BusinessApplication.objects.filter(
            applicant=request.user,
        ).select_related('resulting_business')[:10]])

    def post(self, request):
        serializer = ApplicationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data.copy()
        photos = data.pop('photos')
        days = data.pop('working_days')
        open_time, close_time = data.pop('open_time'), data.pop('close_time')
        with transaction.atomic():
            # Serialize submissions from the same account on PostgreSQL.
            User.objects.select_for_update().get(pk=request.user.pk)
            if BusinessApplication.objects.filter(applicant=request.user, status=BusinessApplicationStatus.PENDING).exists():
                return Response({'error': 'Avvalgi arizangiz ko‘rib chiqilmoqda.'}, status=status.HTTP_409_CONFLICT)
            application = BusinessApplication.objects.create(
                applicant=request.user, telegram_chat_id=request.user.telegram_chat_id or '',
                status=BusinessApplicationStatus.PENDING, step=BusinessApplicationStep.DONE, **data,
            )
            for day in range(7):
                BusinessApplicationHours.objects.create(
                    application=application, day_of_week=day, is_closed=day not in days,
                    open_time=open_time.strftime('%H:%M'), close_time=close_time.strftime('%H:%M'),
                )
            for order, photo in enumerate(photos):
                BusinessApplicationPhoto.objects.create(application=application, order=order, image=photo)
            def notify():
                try:
                    notify_owner(application)
                except Exception:
                    logger.exception('admin_application_notification_failed application=%s', application.id)
            transaction.on_commit(notify)
        return Response(payload(application), status=status.HTTP_201_CREATED)
