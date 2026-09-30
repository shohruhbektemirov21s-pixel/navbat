from django.urls import path
from .views import (
    CategoryListView, CityListView, BusinessListView, BusinessDetailView,
    BusinessCurrentView, BusinessServicesView, BusinessServiceDetailView,
    BusinessStaffView, BusinessHoursView, BusinessProfileView, BusinessRegisterView,
    CustomerFavoritesView, CustomerFavoriteIdsView, CustomerFavoriteToggleView,
    ReviewCreateView, AdminBusinessesListView, AdminBusinessStatusUpdateView
)

urlpatterns = [
    # Public
    path('categories', CategoryListView.as_view(), name='categories-list'),
    path('cities', CityListView.as_view(), name='cities-list'),
    path('businesses', BusinessListView.as_view(), name='businesses-list'),
    path('businesses/register', BusinessRegisterView.as_view(), name='business-register'),
    path('businesses/<str:slug>', BusinessDetailView.as_view(), name='business-detail'),

    # Business management (current owner / staff)
    path('business/current', BusinessCurrentView.as_view(), name='business-current'),
    path('business/services', BusinessServicesView.as_view(), name='business-services'),
    path('business/services/<str:pk>', BusinessServiceDetailView.as_view(), name='business-service-detail'),
    path('business/staff', BusinessStaffView.as_view(), name='business-staff'),
    path('business/working-hours', BusinessHoursView.as_view(), name='business-working-hours'),
    path('business/profile', BusinessProfileView.as_view(), name='business-profile'),

    # Customer Favorites
    path('customer/favorites', CustomerFavoritesView.as_view(), name='customer-favorites'),
    path('customer/favorites/ids', CustomerFavoriteIdsView.as_view(), name='customer-favorite-ids'),
    path('customer/favorites/<str:business_id>/toggle', CustomerFavoriteToggleView.as_view(), name='customer-favorite-toggle'),

    # Reviews
    path('reviews', ReviewCreateView.as_view(), name='create-review'),

    # Admin Business
    path('admin/businesses', AdminBusinessesListView.as_view(), name='admin-businesses'),
    path('admin/businesses/<str:business_id>/status', AdminBusinessStatusUpdateView.as_view(), name='admin-business-status'),
]
