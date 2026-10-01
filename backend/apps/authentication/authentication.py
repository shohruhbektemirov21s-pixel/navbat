from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class ActiveUserJWTAuthentication(JWTAuthentication):
    """JWT auth that also rejects suspended / deactivated accounts on every request."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.is_active or getattr(user, 'status', 'ACTIVE') == 'SUSPENDED':
            raise AuthenticationFailed('Hisobingiz to‘xtatilgan. Administrator bilan bog‘laning.', code='user_inactive')
        return user
