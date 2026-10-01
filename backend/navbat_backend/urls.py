from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path


def api_not_found(request, *args, **kwargs):
    return JsonResponse({'error': 'API manzili topilmadi.'}, status=404)


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

    # Unknown API paths answer with JSON (the SPA expects `{error}`), never an HTML page.
    re_path(r'^api/', api_not_found),
]

if settings.DEBUG:
    # Dev-only: serve uploaded media (business application photos) directly from Django.
    # In production this is expected to be served by the web server / object storage.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
