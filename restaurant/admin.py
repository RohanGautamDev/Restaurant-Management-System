"""
DineMind AI - Admin Panel Configuration
Rich admin interface with stock alerts, order summaries, and management tools.
"""
from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from .models import (
    InventoryItem, MenuItem, MenuItemIngredient,
    RestaurantTable, Reservation, Order, OrderItem, FoodWasteLog
)


# ─── Inline Admin Classes ─────────────────────────────

class MenuItemIngredientInline(admin.TabularInline):
    model = MenuItemIngredient
    extra = 1
    fields = ['inventory_item', 'required_quantity']


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['price_at_order', 'subtotal']
    fields = ['menu_item', 'quantity', 'price_at_order', 'notes']

    def subtotal(self, obj):
        return f"${obj.subtotal:.2f}"
    subtotal.short_description = 'Subtotal'


# ─── InventoryItem Admin ─────────────────────────────

@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'quantity_display', 'unit', 'min_stock_threshold', 'stock_status_badge', 'cost_per_unit', 'updated_at']
    list_filter = ['unit']
    search_fields = ['name']
    ordering = ['name']
    readonly_fields = ['updated_at', 'created_at']

    def quantity_display(self, obj):
        return f"{obj.quantity} {obj.unit}"
    quantity_display.short_description = 'Current Stock'

    def stock_status_badge(self, obj):
        status = obj.stock_status
        colors = {
            'in_stock': '#28a745',
            'low_stock': '#fd7e14',
            'out_of_stock': '#dc3545',
        }
        labels = {
            'in_stock': '✅ In Stock',
            'low_stock': '⚠️ Low Stock',
            'out_of_stock': '❌ Out of Stock',
        }
        color = colors.get(status, '#6c757d')
        label = labels.get(status, status)
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;border-radius:4px;font-size:12px;">{}</span>',
            color, label
        )
    stock_status_badge.short_description = 'Stock Status'


# ─── MenuItem Admin ─────────────────────────────────

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price_display', 'availability_badge', 'is_vegetarian', 'spice_level', 'prep_time_minutes']
    list_filter = ['category', 'is_available', 'is_vegetarian']
    search_fields = ['name', 'description']
    inlines = [MenuItemIngredientInline]
    readonly_fields = ['created_at', 'updated_at']
    actions = ['mark_available', 'mark_unavailable', 'sync_availability_action']

    def price_display(self, obj):
        return f"${obj.price:.2f}"
    price_display.short_description = 'Price'

    def availability_badge(self, obj):
        if obj.is_available:
            return format_html('<span style="background:#28a745;color:white;padding:3px 8px;border-radius:4px;font-size:12px;">✅ Available</span>')
        return format_html('<span style="background:#dc3545;color:white;padding:3px 8px;border-radius:4px;font-size:12px;">❌ Out of Stock</span>')
    availability_badge.short_description = 'Availability'

    def mark_available(self, request, queryset):
        queryset.update(is_available=True)
        self.message_user(request, f"{queryset.count()} items marked as available.")
    mark_available.short_description = "Mark selected items as Available"

    def mark_unavailable(self, request, queryset):
        queryset.update(is_available=False)
        self.message_user(request, f"{queryset.count()} items marked as unavailable.")
    mark_unavailable.short_description = "Mark selected items as Unavailable"

    def sync_availability_action(self, request, queryset):
        for item in queryset:
            item.sync_availability()
        self.message_user(request, f"Availability synced for {queryset.count()} items based on current inventory.")
    sync_availability_action.short_description = "Sync availability based on inventory"


# ─── RestaurantTable Admin ───────────────────────────

@admin.register(RestaurantTable)
class RestaurantTableAdmin(admin.ModelAdmin):
    list_display = ['table_number', 'capacity', 'status_badge', 'location']
    list_filter = ['status', 'location']
    search_fields = ['table_number']

    def status_badge(self, obj):
        colors = {
            'available': '#28a745',
            'occupied': '#dc3545',
            'reserved': '#fd7e14',
            'maintenance': '#6c757d',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;border-radius:4px;font-size:12px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


# ─── Reservation Admin ───────────────────────────────

@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ['customer_name', 'num_guests', 'reservation_time', 'table', 'status_badge', 'customer_phone']
    list_filter = ['status', 'reservation_time']
    search_fields = ['customer_name', 'customer_phone', 'customer_email']
    date_hierarchy = 'reservation_time'

    def status_badge(self, obj):
        colors = {
            'pending': '#ffc107',
            'confirmed': '#17a2b8',
            'seated': '#28a745',
            'completed': '#6c757d',
            'cancelled': '#dc3545',
            'no_show': '#343a40',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;border-radius:4px;font-size:12px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


# ─── Order Admin ─────────────────────────────────────

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'table', 'status_badge', 'payment_status', 'total_amount_display', 'created_at']
    list_filter = ['status', 'payment_status', 'created_at']
    search_fields = ['table__table_number']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'updated_at', 'total_amount']
    inlines = [OrderItemInline]
    actions = ['mark_preparing', 'mark_completed', 'mark_cancelled']

    def total_amount_display(self, obj):
        return f"${obj.total_amount:.2f}"
    total_amount_display.short_description = 'Total'

    def status_badge(self, obj):
        colors = {
            'pending': '#ffc107',
            'preparing': '#17a2b8',
            'ready': '#28a745',
            'completed': '#6c757d',
            'cancelled': '#dc3545',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;border-radius:4px;font-size:12px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    def mark_preparing(self, request, queryset):
        queryset.update(status='preparing')
    mark_preparing.short_description = "Move to Preparing"

    def mark_completed(self, request, queryset):
        queryset.update(status='completed')
    mark_completed.short_description = "Mark as Completed"

    def mark_cancelled(self, request, queryset):
        queryset.update(status='cancelled')
    mark_cancelled.short_description = "Mark as Cancelled"


# ─── FoodWasteLog Admin ──────────────────────────────

@admin.register(FoodWasteLog)
class FoodWasteLogAdmin(admin.ModelAdmin):
    list_display = ['inventory_item', 'quantity_wasted', 'reason', 'estimated_cost_display', 'logged_at', 'logged_by']
    list_filter = ['reason', 'logged_at']
    search_fields = ['inventory_item__name']
    date_hierarchy = 'logged_at'

    def estimated_cost_display(self, obj):
        return f"${obj.estimated_cost:.2f}"
    estimated_cost_display.short_description = 'Est. Cost'
