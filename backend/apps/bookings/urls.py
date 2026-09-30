from django.urls import path
from .views import (
    AvailableSlotsView, CreateBookingView, CustomerBookingsView,
    CancelBookingView, RescheduleBookingView, BusinessCalendarBookingsView,
    BusinessBookingStatusUpdateView, BusinessBlockedTimesView,
    BusinessBlockedTimeDetailView, AdminAllBookingsView
)

urlpatterns = [
    path('bookings', CreateBookingView.as_view(), name='create-booking'),
    path('customer/bookings', CustomerBookingsView.as_view(), name='customer-bookings'),
    path('customer/bookings/<str:booking_id>/cancel', CancelBookingView.as_view(), name='cancel-booking'),
    path('customer/bookings/<str:booking_id>/reschedule', RescheduleBookingView.as_view(), name='reschedule-booking'),
    path('businesses/<str:business_id>/available-slots', AvailableSlotsView.as_view(), name='available-slots'),

    # Business booking management
    path('business/calendar', BusinessCalendarBookingsView.as_view(), name='business-calendar'),
    path('business/bookings/<str:booking_id>/status', BusinessBookingStatusUpdateView.as_view(), name='business-booking-status'),
    path('business/bookings/<str:booking_id>/cancel', CancelBookingView.as_view(), name='business-cancel-booking'),
    path('business/bookings/<str:booking_id>/reschedule', RescheduleBookingView.as_view(), name='business-reschedule-booking'),
    path('business/blocked-times', BusinessBlockedTimesView.as_view(), name='business-blocked-times'),
    path('business/blocked-times/<str:pk>', BusinessBlockedTimeDetailView.as_view(), name='business-blocked-time-detail'),

    # Admin Bookings
    path('admin/all-bookings', AdminAllBookingsView.as_view(), name='admin-all-bookings'),
    path('admin/bookings/<str:booking_id>/status', BusinessBookingStatusUpdateView.as_view(), name='admin-booking-status'),
    path('admin/blocked-times', BusinessBlockedTimesView.as_view(), name='admin-blocked-times'),
    path('admin/blocked-times/<str:pk>', BusinessBlockedTimeDetailView.as_view(), name='admin-blocked-time-detail'),
]
