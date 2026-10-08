from django.urls import path
from .application_views import BusinessApplicationSubmitView

from .views import (
    AdminBusinessApplicationApproveView, AdminBusinessApplicationRejectView, AdminBusinessApplicationsListView,
    AdminBusinessesListView, AdminBusinessStatusUpdateView, AdminReviewDeleteView, AdminReviewsView,
    BusinessCurrentView, BusinessDetailView, BusinessHoursView, BusinessListView, BusinessProfileView,
    BusinessServiceDetailView, BusinessTelegramSettingsView, BusinessServicesView, BusinessStaffView, CategoryListView,
    CityListView, CustomerFavoriteIdsView, CustomerFavoritesView, CustomerFavoriteToggleView, ReviewCreateView,
)

urlpatterns = [
    path('business-applications', BusinessApplicationSubmitView.as_view(), name='business-application-submit'),
    # Public
    path('categories', CategoryListView.as_view(), name='categories-list'),
    path('cities', CityListView.as_view(), name='cities-list'),
    path('businesses', BusinessListView.as_view(), name='businesses-list'),
    path('businesses/<str:slug>', BusinessDetailView.as_view(), name='business-detail'),

    # Business management (current owner / staff)
    path('business/current', BusinessCurrentView.as_view(), name='business-current'),
    path('business/services', BusinessServicesView.as_view(), name='business-services'),
    path('business/services/<str:pk>', BusinessServiceDetailView.as_view(), name='business-service-detail'),
    path('business/staff', BusinessStaffView.as_view(), name='business-staff'),
    path('business/working-hours', BusinessHoursView.as_view(), name='business-working-hours'),
    path('business/profile', BusinessProfileView.as_view(), name='business-profile'),
    path('business/telegram-settings', BusinessTelegramSettingsView.as_view(), name='business-telegram-settings'),

    # Customer favourites
    path('customer/favorites', CustomerFavoritesView.as_view(), name='customer-favorites'),
    path('customer/favorites/ids', CustomerFavoriteIdsView.as_view(), name='customer-favorite-ids'),
    path('customer/favorites/<str:business_id>/toggle', CustomerFavoriteToggleView.as_view(), name='customer-favorite-toggle'),

    # Reviews
    path('reviews', ReviewCreateView.as_view(), name='create-review'),

    # Admin
    path('admin/businesses', AdminBusinessesListView.as_view(), name='admin-businesses'),
    path('admin/businesses/<str:business_id>/status', AdminBusinessStatusUpdateView.as_view(), name='admin-business-status'),
    path('admin/reviews', AdminReviewsView.as_view(), name='admin-reviews'),
    path('admin/reviews/<str:review_id>/delete', AdminReviewDeleteView.as_view(), name='admin-review-delete'),

    # Admin: Telegram-bot business applications
    path('admin/business-applications', AdminBusinessApplicationsListView.as_view(), name='admin-business-applications'),
    path('admin/business-applications/<str:application_id>/approve', AdminBusinessApplicationApproveView.as_view(),
         name='admin-business-application-approve'),
    path('admin/business-applications/<str:application_id>/reject', AdminBusinessApplicationRejectView.as_view(),
         name='admin-business-application-reject'),
]
