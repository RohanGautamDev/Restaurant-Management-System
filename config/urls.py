"""
DineMind AI - URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

# Admin customization
admin.site.site_header = 'DineMind AI Admin'
admin.site.site_title = 'DineMind AI'
admin.site.index_title = 'Restaurant Operations Control Panel'

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('restaurant.urls')),
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
