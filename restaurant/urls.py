"""
DineMind AI - URL Routes
All REST API endpoints with DRF router.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InventoryViewSet,
    MenuItemViewSet,
    RestaurantTableViewSet,
    ReservationViewSet,
    OrderViewSet,
    FoodWasteViewSet,
    DashboardStatsView,
    DailySalesReportView,
    PeakHoursReportView,
    PopularItemsReportView,
    LowStockReportView,
)

router = DefaultRouter()
router.register(r'inventory', InventoryViewSet, basename='inventory')
router.register(r'menu', MenuItemViewSet, basename='menu')
router.register(r'tables', RestaurantTableViewSet, basename='tables')
router.register(r'reservations', ReservationViewSet, basename='reservations')
router.register(r'orders', OrderViewSet, basename='orders')
router.register(r'waste', FoodWasteViewSet, basename='waste')

urlpatterns = [
    path('', include(router.urls)),

    # Dashboard & Reports
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('reports/daily-sales/', DailySalesReportView.as_view(), name='report-daily-sales'),
    path('reports/peak-hours/', PeakHoursReportView.as_view(), name='report-peak-hours'),
    path('reports/popular-items/', PopularItemsReportView.as_view(), name='report-popular-items'),
    path('reports/low-stock/', LowStockReportView.as_view(), name='report-low-stock'),
]
