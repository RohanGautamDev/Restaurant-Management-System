"""
DineMind AI - API Views & Business Logic
Transaction-safe order processing, smart table recommendation, analytics, and reporting.
"""
from django.db import transaction
from django.db.models import (
    Sum, Count, Avg, Q, F, DecimalField,
    ExpressionWrapper, functions
)
from django.db.models.functions import TruncHour, TruncDate, TruncMonth
from django.utils import timezone
from django.utils.dateparse import parse_date
from datetime import timedelta, datetime

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    InventoryItem, MenuItem, MenuItemIngredient,
    RestaurantTable, Reservation, Order, OrderItem, FoodWasteLog
)
from .serializers import (
    InventoryItemSerializer, InventoryUpdateSerializer,
    MenuItemSerializer, MenuItemCreateSerializer,
    RestaurantTableSerializer,
    ReservationSerializer,
    OrderSerializer, OrderCreateSerializer, OrderStatusUpdateSerializer,
    FoodWasteLogSerializer,
)


# ─────────────────────────────────────────────
# INVENTORY VIEWSET
# ─────────────────────────────────────────────

class InventoryViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action in ['partial_update', 'update']:
            return InventoryUpdateSerializer
        return InventoryItemSerializer

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        """Return all items at or below minimum stock threshold."""
        low = InventoryItem.objects.filter(quantity__lte=F('min_stock_threshold'))
        serializer = InventoryItemSerializer(low, many=True)
        return Response({
            'count': low.count(),
            'items': serializer.data
        })

    def perform_update(self, serializer):
        instance = serializer.save()
        # After stock is updated, re-sync all menu item availability
        for link in instance.used_in.all():
            link.menu_item.sync_availability()


# ─────────────────────────────────────────────
# MENU VIEWSET
# ─────────────────────────────────────────────

class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.prefetch_related('ingredients__inventory_item').all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'category', 'description']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MenuItemCreateSerializer
        return MenuItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        available = self.request.query_params.get('available')
        if category:
            qs = qs.filter(category=category)
        if available is not None:
            qs = qs.filter(is_available=(available.lower() == 'true'))
        return qs

    @action(detail=True, methods=['post'], url_path='sync-availability')
    def sync_availability(self, request, pk=None):
        """Manually trigger availability re-sync for a menu item."""
        item = self.get_object()
        is_available = item.sync_availability()
        return Response({
            'id': item.id,
            'name': item.name,
            'is_available': is_available,
            'message': 'Availability synced based on current inventory.'
        })

    @action(detail=False, methods=['post'], url_path='sync-all')
    def sync_all_availability(self, request):
        """Sync availability for all menu items."""
        items = MenuItem.objects.prefetch_related('ingredients__inventory_item').all()
        updated = 0
        for item in items:
            old = item.is_available
            item.sync_availability()
            if old != item.is_available:
                updated += 1
        return Response({'message': f'Synced {items.count()} items. {updated} availability changes.'})


# ─────────────────────────────────────────────
# TABLE VIEWSET
# ─────────────────────────────────────────────

class RestaurantTableViewSet(viewsets.ModelViewSet):
    queryset = RestaurantTable.objects.all()
    serializer_class = RestaurantTableSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        location = self.request.query_params.get('location')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if location:
            qs = qs.filter(location=location)
        return qs

    @action(detail=False, methods=['get'], url_path='recommend')
    def recommend(self, request):
        """
        Smart Table Recommendation.
        Finds the best available table for the given number of guests.
        Prefers smallest table that fits (to avoid wasting large tables).
        """
        guests = request.query_params.get('guests', 2)
        try:
            guests = int(guests)
        except (ValueError, TypeError):
            return Response({'error': 'guests must be a positive integer.'}, status=400)

        if guests < 1:
            return Response({'error': 'guests must be at least 1.'}, status=400)

        # Find available tables with sufficient capacity, sorted by capacity (closest match first)
        tables = RestaurantTable.objects.filter(
            status='available',
            capacity__gte=guests
        ).order_by('capacity', 'table_number')

        if not tables.exists():
            return Response({
                'recommended': None,
                'message': f'No available tables for {guests} guests at this time.',
                'guests_requested': guests,
            }, status=200)

        best = tables.first()
        serializer = RestaurantTableSerializer(best)
        return Response({
            'recommended': serializer.data,
            'message': f'Table {best.table_number} is the best match for {guests} guests.',
            'guests_requested': guests,
            'alternatives': RestaurantTableSerializer(tables[1:4], many=True).data
        })

    @action(detail=False, methods=['get'], url_path='availability-summary')
    def availability_summary(self, request):
        """Quick summary of table statuses."""
        tables = RestaurantTable.objects.all()
        summary = {}
        for choice_value, choice_label in RestaurantTable.STATUS_CHOICES:
            summary[choice_value] = tables.filter(status=choice_value).count()
        return Response({
            'total': tables.count(),
            **summary
        })


# ─────────────────────────────────────────────
# RESERVATION VIEWSET
# ─────────────────────────────────────────────

class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.select_related('table').all()
    serializer_class = ReservationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['customer_name', 'customer_phone', 'customer_email']

    def get_queryset(self):
        qs = super().get_queryset()
        date_str = self.request.query_params.get('date')
        status_filter = self.request.query_params.get('status')
        upcoming = self.request.query_params.get('upcoming')

        if date_str:
            try:
                d = parse_date(date_str)
                if d:
                    qs = qs.filter(reservation_time__date=d)
            except Exception:
                pass

        if status_filter:
            qs = qs.filter(status=status_filter)

        if upcoming and upcoming.lower() == 'true':
            qs = qs.filter(reservation_time__gte=timezone.now())

        return qs

    def perform_create(self, serializer):
        reservation = serializer.save()
        # Mark table as reserved
        if reservation.table:
            reservation.table.status = 'reserved'
            reservation.table.save(update_fields=['status'])

    def perform_update(self, serializer):
        old_status = self.get_object().status
        reservation = serializer.save()
        # When cancelled/completed, release the table
        if reservation.status in ['cancelled', 'completed', 'no_show']:
            if reservation.table:
                # Only release if no active order on that table
                active_orders = Order.objects.filter(
                    table=reservation.table,
                    status__in=['pending', 'preparing', 'ready']
                ).exists()
                if not active_orders:
                    reservation.table.status = 'available'
                    reservation.table.save(update_fields=['status'])


# ─────────────────────────────────────────────
# ORDER VIEWSET — Core Transaction Logic
# ─────────────────────────────────────────────

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('table').prefetch_related('items__menu_item').all()
    serializer_class = OrderSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['table__table_number']

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        table_id = self.request.query_params.get('table')
        date_str = self.request.query_params.get('date')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if table_id:
            qs = qs.filter(table_id=table_id)
        if date_str:
            try:
                d = parse_date(date_str)
                if d:
                    qs = qs.filter(created_at__date=d)
            except Exception:
                pass
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        if self.action in ['partial_update', 'update']:
            return OrderStatusUpdateSerializer
        return OrderSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Transaction-safe order creation:
        1. Validate table + items
        2. Check ingredient inventory for ALL items
        3. Create order + order items
        4. Deduct inventory
        5. Update table status
        6. Sync menu item availability
        """
        input_serializer = OrderCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        table = RestaurantTable.objects.select_for_update().get(pk=data['table_id'])
        items_data = data['items']

        # ── Resolve menu items and check availability ──
        menu_items_map = {}
        for item_input in items_data:
            menu_item_id = item_input['menu_item_id']
            menu_item = MenuItem.objects.prefetch_related(
                'ingredients__inventory_item'
            ).get(pk=menu_item_id)
            if not menu_item.is_available:
                return Response(
                    {'error': f"'{menu_item.name}' is currently not available (out of stock)."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            menu_items_map[menu_item_id] = menu_item

        # ── Aggregate total ingredient requirements ──
        ingredient_requirements = {}
        for item_input in items_data:
            menu_item = menu_items_map[item_input['menu_item_id']]
            qty = item_input['quantity']
            for ingredient_link in menu_item.ingredients.all():
                inv_id = ingredient_link.inventory_item_id
                needed = ingredient_link.required_quantity * qty
                ingredient_requirements[inv_id] = ingredient_requirements.get(inv_id, 0) + float(needed)

        # ── Check all inventory in one pass ──
        insufficient = []
        inventory_items = {}
        for inv_id, needed in ingredient_requirements.items():
            inv_item = InventoryItem.objects.select_for_update().get(pk=inv_id)
            inventory_items[inv_id] = inv_item
            if float(inv_item.quantity) < needed:
                insufficient.append(
                    f"{inv_item.name}: need {needed:.2f}{inv_item.unit}, have {float(inv_item.quantity):.2f}{inv_item.unit}"
                )

        if insufficient:
            return Response({
                'error': 'Insufficient inventory to fulfill this order.',
                'details': insufficient
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Create order ──
        order = Order.objects.create(
            table=table,
            notes=data.get('notes', ''),
            status='pending'
        )

        # ── Create order items ──
        total = 0
        for item_input in items_data:
            menu_item = menu_items_map[item_input['menu_item_id']]
            qty = item_input['quantity']
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=qty,
                price_at_order=menu_item.price,
                notes=item_input.get('notes', '')
            )
            total += float(menu_item.price) * qty

        # ── Update order total ──
        from decimal import Decimal
        order.total_amount = Decimal(str(round(total, 2)))
        order.save(update_fields=['total_amount'])

        # ── Deduct inventory ──
        for inv_id, needed in ingredient_requirements.items():
            inv_item = inventory_items[inv_id]
            from decimal import Decimal as D
            inv_item.quantity = D(str(float(inv_item.quantity) - needed))
            inv_item.save(update_fields=['quantity'])

        # ── Update table status ──
        table.status = 'occupied'
        table.save(update_fields=['status'])

        # ── Sync menu availability for affected items ──
        for inv_id in ingredient_requirements:
            inv_item = inventory_items[inv_id]
            for link in inv_item.used_in.all():
                link.menu_item.sync_availability()

        # ── Return created order ──
        response_serializer = OrderSerializer(order)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        old_status = order.status
        serializer = OrderStatusUpdateSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        # When order is completed/cancelled, free the table
        if order.status in ['completed', 'cancelled'] and old_status not in ['completed', 'cancelled']:
            if order.table:
                # Check for other active orders on same table
                other_active = Order.objects.filter(
                    table=order.table,
                    status__in=['pending', 'preparing', 'ready']
                ).exclude(pk=order.pk).exists()
                if not other_active:
                    order.table.status = 'available'
                    order.table.save(update_fields=['status'])

        return Response(OrderSerializer(order).data)


# ─────────────────────────────────────────────
# FOOD WASTE VIEWSET
# ─────────────────────────────────────────────

class FoodWasteViewSet(viewsets.ModelViewSet):
    queryset = FoodWasteLog.objects.select_related('inventory_item').all()
    serializer_class = FoodWasteLogSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        """Deduct wasted quantity from actual inventory."""
        log = serializer.save()
        # Deduct from inventory
        from decimal import Decimal
        inv = log.inventory_item
        new_qty = max(Decimal('0'), inv.quantity - log.quantity_wasted)
        inv.quantity = new_qty
        inv.save(update_fields=['quantity'])
        # Re-sync menu items
        for link in inv.used_in.all():
            link.menu_item.sync_availability()

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Waste analytics summary."""
        logs = FoodWasteLog.objects.all()
        total_cost = logs.aggregate(total=Sum('estimated_cost'))['total'] or 0
        by_reason = logs.values('reason').annotate(
            count=Count('id'),
            total_cost=Sum('estimated_cost')
        ).order_by('-total_cost')

        by_item = logs.values(
            item_name=F('inventory_item__name'),
            unit=F('inventory_item__unit')
        ).annotate(
            total_wasted=Sum('quantity_wasted'),
            waste_cost=Sum('estimated_cost')
        ).order_by('-waste_cost')[:10]

        # This week
        week_ago = timezone.now() - timedelta(days=7)
        weekly_logs = logs.filter(logged_at__gte=week_ago)
        weekly_cost = weekly_logs.aggregate(total=Sum('estimated_cost'))['total'] or 0

        return Response({
            'total_waste_cost': float(total_cost),
            'total_entries': logs.count(),
            'weekly_waste_cost': float(weekly_cost),
            'by_reason': list(by_reason),
            'top_wasted_items': list(by_item),
        })


# ─────────────────────────────────────────────
# ANALYTICS / REPORTS
# ─────────────────────────────────────────────

class DashboardStatsView(APIView):
    """Real-time dashboard KPIs."""

    def get(self, request):
        today = timezone.now().date()
        now = timezone.now()

        # Today's revenue
        today_revenue = Order.objects.filter(
            created_at__date=today,
            status='completed'
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        # Today's orders
        today_orders = Order.objects.filter(created_at__date=today).count()

        # Table status
        tables = RestaurantTable.objects.all()
        available_tables = tables.filter(status='available').count()
        occupied_tables = tables.filter(status='occupied').count()
        reserved_tables = tables.filter(status='reserved').count()
        total_tables = tables.count()

        # Low stock items
        from django.db.models import F
        low_stock_items = InventoryItem.objects.filter(
            quantity__lte=F('min_stock_threshold')
        )
        low_stock_count = low_stock_items.count()
        low_stock_list = [
            {'name': i.name, 'quantity': float(i.quantity), 'unit': i.unit, 'threshold': float(i.min_stock_threshold)}
            for i in low_stock_items[:5]
        ]

        # Popular dish (today)
        popular = OrderItem.objects.filter(
            order__created_at__date=today
        ).values(
            name=F('menu_item__name')
        ).annotate(
            total_ordered=Sum('quantity')
        ).order_by('-total_ordered').first()

        # Total revenue all time
        total_revenue = Order.objects.filter(
            status='completed'
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        # Active orders (not completed/cancelled)
        active_orders = Order.objects.filter(
            status__in=['pending', 'preparing', 'ready']
        ).count()

        return Response({
            'today_revenue': float(today_revenue),
            'today_orders': today_orders,
            'active_orders': active_orders,
            'available_tables': available_tables,
            'occupied_tables': occupied_tables,
            'reserved_tables': reserved_tables,
            'total_tables': total_tables,
            'low_stock_count': low_stock_count,
            'low_stock_items': low_stock_list,
            'popular_dish': popular['name'] if popular else 'N/A',
            'popular_dish_count': popular['total_ordered'] if popular else 0,
            'total_revenue_all_time': float(total_revenue),
            'timestamp': now.isoformat(),
        })


class DailySalesReportView(APIView):
    """Daily sales report with per-day breakdown."""

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start_date = (timezone.now() - timedelta(days=days)).date()

        daily_sales = Order.objects.filter(
            status='completed',
            created_at__date__gte=start_date
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            total_revenue=Sum('total_amount'),
            total_orders=Count('id')
        ).order_by('date')

        # Today specifically
        today = timezone.now().date()
        today_data = Order.objects.filter(
            created_at__date=today,
            status='completed'
        ).aggregate(
            revenue=Sum('total_amount'),
            orders=Count('id')
        )

        return Response({
            'period_days': days,
            'start_date': str(start_date),
            'today': {
                'revenue': float(today_data['revenue'] or 0),
                'orders': today_data['orders'] or 0,
            },
            'daily_breakdown': [
                {
                    'date': str(d['date']),
                    'revenue': float(d['total_revenue'] or 0),
                    'orders': d['total_orders'],
                }
                for d in daily_sales
            ]
        })


class PeakHoursReportView(APIView):
    """Analyze order timestamps to find busiest hours."""

    def get(self, request):
        days = int(request.query_params.get('days', 14))
        start = timezone.now() - timedelta(days=days)

        hourly = Order.objects.filter(
            created_at__gte=start
        ).annotate(
            hour=TruncHour('created_at')
        ).values('hour').annotate(
            order_count=Count('id'),
            revenue=Sum('total_amount')
        ).order_by('hour')

        # Aggregate by hour-of-day
        by_hour = {}
        for entry in hourly:
            h = entry['hour'].hour
            if h not in by_hour:
                by_hour[h] = {'order_count': 0, 'revenue': 0.0, 'hour': h}
            by_hour[h]['order_count'] += entry['order_count']
            by_hour[h]['revenue'] += float(entry['revenue'] or 0)

        sorted_hours = sorted(by_hour.values(), key=lambda x: x['hour'])
        peak = max(sorted_hours, key=lambda x: x['order_count']) if sorted_hours else None

        return Response({
            'period_days': days,
            'peak_hour': peak['hour'] if peak else None,
            'peak_hour_formatted': f"{peak['hour']:02d}:00 - {(peak['hour']+1):02d}:00" if peak else None,
            'peak_order_count': peak['order_count'] if peak else 0,
            'hourly_breakdown': sorted_hours,
        })


class PopularItemsReportView(APIView):
    """Most ordered menu items with revenue breakdown."""

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        limit = int(request.query_params.get('limit', 10))
        start = (timezone.now() - timedelta(days=days)).date()

        popular = OrderItem.objects.filter(
            order__created_at__date__gte=start,
            order__status='completed'
        ).values(
            name=F('menu_item__name'),
            category=F('menu_item__category'),
            price=F('menu_item__price'),
        ).annotate(
            total_ordered=Sum('quantity'),
            total_revenue=Sum(
                ExpressionWrapper(F('quantity') * F('price_at_order'), output_field=DecimalField())
            )
        ).order_by('-total_ordered')[:limit]

        return Response({
            'period_days': days,
            'top_items': [
                {
                    'name': p['name'],
                    'category': p['category'],
                    'price': float(p['price']),
                    'total_ordered': p['total_ordered'],
                    'total_revenue': float(p['total_revenue'] or 0),
                }
                for p in popular
            ]
        })


class LowStockReportView(APIView):
    """All inventory items at or below minimum threshold."""

    def get(self, request):
        from django.db.models import F
        low = InventoryItem.objects.filter(quantity__lte=F('min_stock_threshold')).order_by('quantity')
        out = InventoryItem.objects.filter(quantity=0)

        return Response({
            'low_stock_count': low.count(),
            'out_of_stock_count': out.count(),
            'low_stock_items': [
                {
                    'id': i.id,
                    'name': i.name,
                    'quantity': float(i.quantity),
                    'unit': i.unit,
                    'min_threshold': float(i.min_stock_threshold),
                    'status': i.stock_status,
                    'deficit': float(i.min_stock_threshold - i.quantity),
                }
                for i in low
            ]
        })
