import re

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User, UserRole, UserStatus

PHONE_RE = re.compile(r'^\+?[0-9 ()-]{7,20}$')


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'name', 'email', 'phone', 'role', 'status',
            'telegram_chat_id', 'telegram_username',
            'telegram_notifications_enabled', 'created_at'
        ]
        read_only_fields = fields


class PublicTeamMemberSerializer(serializers.ModelSerializer):
    """Minimal, non-PII view of a team member for non-admin partner staff."""

    class Meta:
        model = User
        fields = ['id', 'name', 'role', 'status']
        read_only_fields = fields


def run_password_validators(password, user=None):
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(' '.join(exc.messages))
    return password


class RegisterSerializer(serializers.Serializer):
    """Public self-registration. The role is ALWAYS CUSTOMER (any client-sent `role` is ignored)."""
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)

    default_error_messages = {}

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Ism kiritilishi shart.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ushbu email allaqachon ro'yxatdan o'tgan.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        if value and not PHONE_RE.match(value):
            raise serializers.ValidationError('Telefon raqami noto‘g‘ri formatda.')
        return value

    def validate(self, attrs):
        probe = User(email=attrs.get('email', ''), name=attrs.get('name', ''))
        run_password_validators(attrs['password'], probe)
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            name=validated_data['name'],
            phone=(validated_data.get('phone') or '').strip() or None,
            role=UserRole.CUSTOMER,
            status=UserStatus.ACTIVE,
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        email = attrs.get('email', '').strip().lower()
        password = attrs.get('password')

        # ModelBackend.authenticate() already refuses users with is_active=False.
        user = authenticate(request=self.context.get('request'), username=email, password=password)
        if not user:
            inactive = User.objects.filter(email__iexact=email, is_active=False).first()
            if inactive and inactive.check_password(password):
                raise serializers.ValidationError("Hisobingiz to'xtatilgan. Administrator bilan bog'laning.")
            raise serializers.ValidationError("Email yoki parol noto'g'ri.")

        if user.status == UserStatus.SUSPENDED:
            raise serializers.ValidationError("Hisobingiz to'xtatilgan. Administrator bilan bog'laning.")

        attrs['user'] = user
        return attrs
