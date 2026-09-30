from django.urls import path
from .views import (
    PlansListView, BusinessSubscriptionView, ActivateBusinessTrialView,
    RequestTelegramPaymentView, RenewBusinessSubscriptionView,
    BusinessPromoteView, BusinessAdAnalyticsView, AdminSubscriptionsView,
    AdminConfirmPaymentView, AdminCancelPaymentView, AdminExtendSubscriptionView,
    AdminPromotionsView
)

urlpatterns = [
    path('plans', PlansListView.as_view(), name='plans-list'),
    path('business/subscription', BusinessSubscriptionView.as_view(), name='business-subscription'),
    path('business/activate-trial', ActivateBusinessTrialView.as_view(), name='business-activate-trial'),
    path('business/request-telegram-payment', RequestTelegramPaymentView.as_view(), name='request-telegram-payment'),
    path('business/renew-subscription', RenewBusinessSubscriptionView.as_view(), name='renew-subscription'),
    path('business/promote', BusinessPromoteView.as_view(), name='business-promote'),
    path('business/ad-analytics', BusinessAdAnalyticsView.as_view(), name='business-ad-analytics'),

    # Admin
    path('admin/subscriptions', AdminSubscriptionsView.as_view(), name='admin-subscriptions'),
    path('admin/subscription-transactions/<str:pk>/confirm', AdminConfirmPaymentView.as_view(), name='admin-confirm-payment'),
    path('admin/subscription-transactions/<str:pk>/cancel', AdminCancelPaymentView.as_view(), name='admin-cancel-payment'),
    path('admin/businesses/<str:business_id>/extend-subscription', AdminExtendSubscriptionView.as_view(), name='admin-extend-sub'),
    path('admin/promotions', AdminPromotionsView.as_view(), name='admin-promotions'),
]
