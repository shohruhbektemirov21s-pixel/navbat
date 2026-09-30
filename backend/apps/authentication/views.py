import uuid
from datetime import timedelta
from django.utils import timezone
from rest_framework import status, views, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, UserRole, UserStatus, TelegramAuthSession, TelegramLinkToken
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer
from .permissions import IsFounderOrAdmin


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    # Include role and name in custom claims if needed
    refresh['role'] = user.role
    refresh['email'] = user.email
    refresh['name'] = user.name
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class RegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            return Response({
                'message': "Ro'yxatdan muvaffaqiyatli o'tdingiz!",
                'user': UserSerializer(user).data,
                'token': tokens['access'],
                'refreshToken': tokens['refresh'],
            }, status=status.HTTP_201_CREATED)
        return Response({'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            tokens = get_tokens_for_user(user)
            return Response({
                'message': "Tizimga muvaffaqiyatli kirdingiz!",
                'user': UserSerializer(user).data,
                'token': tokens['access'],
                'refreshToken': tokens['refresh'],
            })
        first_error = next(iter(serializer.errors.values()))[0] if serializer.errors else "Kirishda xatolik yuz berdi."
        return Response({'error': str(first_error)}, status=status.HTTP_400_BAD_REQUEST)


class GetMeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'user': UserSerializer(request.user).data})


class LogoutView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response({'success': True, 'message': 'Chiqildi'})


class TelegramWebAppLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        tg_user = data.get('user', {})
        chat_id = str(tg_user.get('id', ''))
        first_name = tg_user.get('first_name', '')
        last_name = tg_user.get('last_name', '')
        username = tg_user.get('username', '')
        full_name = f"{first_name} {last_name}".strip() or "Telegram Foydalanuvchisi"

        if not chat_id:
            return Response({'error': "Telegram foydalanuvchi ma'lumotlari topilmadi."}, status=400)

        # Check existing user
        user = User.objects.filter(telegram_chat_id=chat_id).first()
        if not user and username:
            user = User.objects.filter(telegram_username__iexact=username).first()

        if not user:
            # Create user
            email = f"tg_{chat_id}@telegram.navbatbor.uz"
            user = User.objects.create_user(
                email=email,
                name=full_name,
                role=UserRole.CUSTOMER,
                telegram_chat_id=chat_id,
                telegram_username=username,
                status=UserStatus.ACTIVE
            )
        else:
            if not user.telegram_chat_id:
                user.telegram_chat_id = chat_id
            if username and not user.telegram_username:
                user.telegram_username = username
            user.save(update_fields=['telegram_chat_id', 'telegram_username'])

        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'token': tokens['access']
        })


class TelegramSessionCreateView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        session_id = f"tg-ses-{uuid.uuid4().hex[:12]}"
        code = f"{uuid.uuid4().int % 900000 + 100000}"
        expires_at = timezone.now() + timedelta(minutes=10)
        TelegramAuthSession.objects.create(
            session_id=session_id,
            code=code,
            expires_at=expires_at,
            status='PENDING'
        )
        bot_username = "NavbatBor_bot"
        return Response({
            'sessionId': session_id,
            'code': code,
            'botUsername': bot_username,
            'botUrl': f"https://t.me/{bot_username}",
            'deepLink': f"https://t.me/{bot_username}?start=auth_{session_id}",
            'tgDirect': f"tg://resolve?domain={bot_username}&start=auth_{session_id}",
            'expiresAt': expires_at.isoformat()
        })


class TelegramSessionCheckView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, session_id):
        session = TelegramAuthSession.objects.filter(session_id=session_id).first()
        if not session:
            return Response({'status': 'EXPIRED'}, status=404)
        if timezone.now() > session.expires_at:
            session.status = 'EXPIRED'
            session.save(update_fields=['status'])
            return Response({'status': 'EXPIRED'})

        if session.status == 'CONFIRMED' and session.user:
            tokens = get_tokens_for_user(session.user)
            return Response({
                'status': 'CONFIRMED',
                'token': tokens['access'],
                'user': UserSerializer(session.user).data
            })

        return Response({'status': session.status})


class QuickTelegramLoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        phone = request.data.get('phone', '').strip()
        name = request.data.get('name', '').strip() or 'Mijoz'
        username = request.data.get('username', '').strip()
        session_id = request.data.get('sessionId')

        if not phone:
            return Response({'error': "Telefon raqami kiritilishi shart."}, status=400)

        # Clean phone
        clean_phone = ''.join(c for c in phone if c.isdigit() or c == '+')
        user = User.objects.filter(phone=clean_phone).first()

        if not user:
            fake_email = f"user_{uuid.uuid4().hex[:8]}@navbatbor.uz"
            user = User.objects.create_user(
                email=fake_email,
                name=name,
                phone=clean_phone,
                role=UserRole.CUSTOMER,
                telegram_username=username,
                status=UserStatus.ACTIVE
            )

        if session_id:
            TelegramAuthSession.objects.filter(session_id=session_id).update(
                status='CONFIRMED',
                user=user
            )

        tokens = get_tokens_for_user(user)
        return Response({
            'success': True,
            'token': tokens['access'],
            'user': UserSerializer(user).data,
            'message': 'Tezkor kirish muvaffaqiyatli amalga oshirildi.'
        })


class UpdateUserTelegramView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        chat_id = request.data.get('telegram_chat_id', '').strip()
        user = request.user
        user.telegram_chat_id = chat_id
        user.telegram_notifications_enabled = True
        user.save(update_fields=['telegram_chat_id', 'telegram_notifications_enabled'])
        return Response({'success': True, 'message': 'Telegram sozlamalari yangilandi.'})


class CustomerProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        user = request.user
        name = request.data.get('name')
        phone = request.data.get('phone')
        telegram_chat_id = request.data.get('telegram_chat_id')

        if name:
            user.name = name
        if phone is not None:
            user.phone = phone
        if telegram_chat_id is not None:
            user.telegram_chat_id = telegram_chat_id
        user.save()
        return Response(UserSerializer(user).data)


# Admin Users Management
class AdminUsersView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def get(self, request):
        users = User.objects.all().order_by('-created_at')
        return Response(UserSerializer(users, many=True).data)


class AdminCreateUserView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request):
        data = request.data
        email = data.get('email', '').strip().lower()
        name = data.get('name', '').strip()
        password = data.get('password')
        role = data.get('role', UserRole.CUSTOMER)
        phone = data.get('phone', '')

        if not email or not password or not name:
            return Response({'error': "Ism, email va parol kiritilishi shart."}, status=400)

        if User.objects.filter(email=email).exists():
            return Response({'error': "Bu email allaqachon mavjud."}, status=400)

        user = User.objects.create_user(
            email=email,
            password=password,
            name=name,
            role=role,
            phone=phone,
            status=UserStatus.ACTIVE
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminResetPasswordView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({'error': "Foydalanuvchi topilmadi."}, status=404)
        new_password = request.data.get('password')
        if not new_password or len(new_password) < 6:
            return Response({'error': "Parol kamida 6 belgidan iborat bo'lishi kerak."}, status=400)
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'success': True, 'message': 'Parol muvaffaqiyatli yangilandi.'})


class AdminUpdateUserStatusView(views.APIView):
    permission_classes = [IsFounderOrAdmin]

    def post(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({'error': "Foydalanuvchi topilmadi."}, status=404)
        new_status = request.data.get('status')
        new_role = request.data.get('role')
        if new_status and new_status in UserStatus.values:
            user.status = new_status
        if new_role and new_role in UserRole.values:
            user.role = new_role
        user.save()
        return Response(UserSerializer(user).data)
