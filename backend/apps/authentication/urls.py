from django.urls import path
from .views import (
    RegisterView, LoginView, GetMeView, LogoutView,
    TelegramWebAppLoginView, TelegramSessionCreateView, TelegramSessionCheckView,
    QuickTelegramLoginView, UpdateUserTelegramView, CustomerProfileView,
    AdminUsersView, AdminCreateUserView, AdminResetPasswordView, AdminUpdateUserStatusView
)

urlpatterns = [
    path('auth/register', RegisterView.as_view(), name='register'),
    path('auth/login', LoginView.as_view(), name='login'),
    path('auth/me', GetMeView.as_view(), name='me'),
    path('auth/logout', LogoutView.as_view(), name='logout'),
    path('auth/telegram-webapp', TelegramWebAppLoginView.as_view(), name='telegram-webapp'),
    path('auth/telegram-session', TelegramSessionCreateView.as_view(), name='telegram-session-create'),
    path('auth/telegram-session/<str:session_id>', TelegramSessionCheckView.as_view(), name='telegram-session-check'),
    path('auth/telegram-quick-login', QuickTelegramLoginView.as_view(), name='telegram-quick-login'),
    path('user/telegram-settings', UpdateUserTelegramView.as_view(), name='update-user-telegram'),
    path('customer/profile', CustomerProfileView.as_view(), name='customer-profile'),

    # Admin User endpoints
    path('admin/users', AdminUsersView.as_view(), name='admin-users'),
    path('admin/users/create', AdminCreateUserView.as_view(), name='admin-user-create'),
    path('admin/users/<str:user_id>/password', AdminResetPasswordView.as_view(), name='admin-user-reset-pwd'),
    path('admin/users/<str:user_id>/status', AdminUpdateUserStatusView.as_view(), name='admin-user-status'),
]
