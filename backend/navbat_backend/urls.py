from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    # Modular API routes
    path('api/', include('apps.authentication.urls')),
    path('api/', include('apps.core.urls')),
    path('api/', include('apps.marketplace.urls')),
    path('api/', include('apps.bookings.urls')),
    path('api/', include('apps.queues.urls')),
    path('api/', include('apps.partners.urls')),
    path('api/', include('apps.subscriptions.urls')),
    path('api/', include('apps.support.urls')),
    path('api/', include('apps.notifications.urls')),
]
