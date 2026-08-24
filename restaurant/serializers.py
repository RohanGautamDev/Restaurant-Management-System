"""
DineMind AI - API Serializers
Full validation, nested serializers, and business logic for all endpoints.
"""
from rest_framework import serializers
from django.utils import timezone
from .models import (
    InventoryItem, MenuItem, MenuItemIngredient,
    RestaurantTable, Reservation, Order, OrderItem, FoodWasteLog
)


# ─────────────────────────────────────────────
# INVENTORY
# ─────────────────────────────────────────────

class InventoryItemSerializer(serializers.ModelSerializer):
    stock_status = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'quantity', 'unit', 'min_stock_threshold',
            'cost_per_unit', 'stock_status', 'is_low_stock', 'updated_at', 'created_at'
        ]
        read_only_fields = ['updated_at', 'created_at', 'stock_status', 'is_low_stock']

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Quantity cannot be negative.")
        return value


class InventoryUpdateSerializer(serializers.ModelSerializer):
    """For partial updates — just quantity/threshold."""
    class Meta:
        model = InventoryItem
        fields = ['quantity', 'min_stock_threshold', 'cost_per_unit']


# ─────────────────────────────────────────────
# MENU
# ─────────────────────────────────────────────

class MenuItemIngredientSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source='inventory_item.name', read_only=True)
    inventory_item_unit = serializers.CharField(source='inventory_item.unit', read_only=True)

    class Meta:
        model = MenuItemIngredient
        fields = ['id', 'inventory_item', 'inventory_item_name', 'inventory_item_unit', 'required_quantity']


class MenuItemSerializer(serializers.ModelSerializer):
    ingredients = MenuItemIngredientSerializer(many=True, read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    spice_level_display = serializers.CharField(source='get_spice_level_display', read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'category', 'category_display', 'description', 'price',
            'image_url', 'is_available', 'is_vegetarian', 'spice_level',
            'spice_level_display', 'prep_time_minutes', 'ingredients', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class MenuItemCreateSerializer(serializers.ModelSerializer):
    """Used for creating/updating menu items (writable)."""
    ingredients_data = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'category', 'description', 'price',
            'image_url', 'is_available', 'is_vegetarian', 'spice_level',
            'prep_time_minutes', 'ingredients_data'
        ]

    def create(self, validated_data):
        ingredients_data = validated_data.pop('ingredients_data', [])
        menu_item = MenuItem.objects.create(**validated_data)
        for ing in ingredients_data:
            MenuItemIngredient.objects.create(
                menu_item=menu_item,
                inventory_item_id=ing['inventory_item_id'],
                required_quantity=ing['required_quantity']
            )
        return menu_item

    def update(self, instance, validated_data):
        ingredients_data = validated_data.pop('ingredients_data', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if ingredients_data is not None:
            instance.ingredients.all().delete()
            for ing in ingredients_data:
                MenuItemIngredient.objects.create(
                    menu_item=instance,
                    inventory_item_id=ing['inventory_item_id'],
                    required_quantity=ing['required_quantity']
                )
        return instance


# ─────────────────────────────────────────────
# TABLES
# ─────────────────────────────────────────────

class RestaurantTableSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    location_display = serializers.CharField(source='get_location_display', read_only=True)
    is_available = serializers.ReadOnlyField()

    class Meta:
        model = RestaurantTable
        fields = [
            'id', 'table_number', 'capacity', 'status', 'status_display',
            'location', 'location_display', 'is_available', 'notes'
        ]


# ─────────────────────────────────────────────
# RESERVATIONS
# ─────────────────────────────────────────────

class ReservationSerializer(serializers.ModelSerializer):
    table_number = serializers.IntegerField(source='table.table_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    end_time = serializers.ReadOnlyField()

    class Meta:
        model = Reservation
        fields = [
            'id', 'customer_name', 'customer_phone', 'customer_email',
            'num_guests', 'reservation_time', 'duration_minutes', 'end_time',
            'table', 'table_number', 'status', 'status_display',
            'special_requests', 'created_at'
        ]
        read_only_fields = ['created_at', 'end_time', 'table_number']

    def validate_reservation_time(self, value):
        if value < timezone.now():
            raise serializers.ValidationError("Reservation time cannot be in the past.")
        return value

    def validate(self, data):
        """Check for conflicting reservations at the same table/time."""
        table = data.get('table')
        reservation_time = data.get('reservation_time')
        duration = data.get('duration_minutes', 90)

        if table and reservation_time:
            from datetime import timedelta
            end_time = reservation_time + timedelta(minutes=duration)

            conflicts = Reservation.objects.filter(
                table=table,
                status__in=['confirmed', 'pending', 'seated'],
                reservation_time__lt=end_time,
            ).exclude(pk=self.instance.pk if self.instance else None)

            for res in conflicts:
                if res.end_time > reservation_time:
                    raise serializers.ValidationError(
                        f"Table {table.table_number} is already reserved from "
                        f"{res.reservation_time.strftime('%H:%M')} to {res.end_time.strftime('%H:%M')} "
                        f"for {res.customer_name}."
                    )

            if table.capacity < data.get('num_guests', 1):
                raise serializers.ValidationError(
                    f"Table {table.table_number} only seats {table.capacity} guests, "
                    f"but you need {data['num_guests']} seats."
                )

        return data


# ─────────────────────────────────────────────
# ORDERS
# ─────────────────────────────────────────────

class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)
    menu_item_category = serializers.CharField(source='menu_item.category', read_only=True)
    subtotal = serializers.ReadOnlyField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'menu_item', 'menu_item_name', 'menu_item_category',
            'quantity', 'price_at_order', 'subtotal', 'notes'
        ]
        read_only_fields = ['price_at_order', 'subtotal']


class OrderItemCreateSerializer(serializers.Serializer):
    """Used when creating a new order (items input)."""
    menu_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_menu_item_id(self, value):
        try:
            item = MenuItem.objects.get(pk=value)
        except MenuItem.DoesNotExist:
            raise serializers.ValidationError(f"Menu item #{value} does not exist.")
        if not item.is_available:
            raise serializers.ValidationError(f"'{item.name}' is currently not available.")
        return value


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    table_number = serializers.IntegerField(source='table.table_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'table', 'table_number', 'status', 'status_display',
            'payment_status', 'payment_status_display',
            'total_amount', 'items', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['total_amount', 'created_at', 'updated_at']


class OrderCreateSerializer(serializers.Serializer):
    """Full order creation with inventory check and deduction."""
    table_id = serializers.IntegerField()
    items = OrderItemCreateSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_table_id(self, value):
        try:
            table = RestaurantTable.objects.get(pk=value)
        except RestaurantTable.DoesNotExist:
            raise serializers.ValidationError("Table not found.")
        if table.status == 'occupied':
            raise serializers.ValidationError(f"Table {table.table_number} is currently occupied.")
        if table.status == 'maintenance':
            raise serializers.ValidationError(f"Table {table.table_number} is under maintenance.")
        return value

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("An order must have at least one item.")
        return value


class OrderStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['status', 'payment_status', 'notes']


# ─────────────────────────────────────────────
# FOOD WASTE
# ─────────────────────────────────────────────

class FoodWasteLogSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source='inventory_item.name', read_only=True)
    inventory_item_unit = serializers.CharField(source='inventory_item.unit', read_only=True)
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)

    class Meta:
        model = FoodWasteLog
        fields = [
            'id', 'inventory_item', 'inventory_item_name', 'inventory_item_unit',
            'quantity_wasted', 'reason', 'reason_display', 'estimated_cost',
            'notes', 'logged_at', 'logged_by'
        ]
        read_only_fields = ['logged_at']

    def validate_quantity_wasted(self, value):
        if value <= 0:
            raise serializers.ValidationError("Wasted quantity must be positive.")
        return value
