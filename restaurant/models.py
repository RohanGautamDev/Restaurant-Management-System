"""
DineMind AI - Database Models
All restaurant operation models with smart business logic.
"""
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
import decimal


# ─────────────────────────────────────────────
# INVENTORY
# ─────────────────────────────────────────────

class InventoryItem(models.Model):
    """Tracks stock of raw ingredients/supplies."""
    UNIT_CHOICES = [
        ('kg', 'Kilograms'),
        ('g', 'Grams'),
        ('l', 'Litres'),
        ('ml', 'Millilitres'),
        ('pcs', 'Pieces'),
        ('dozen', 'Dozen'),
        ('cup', 'Cups'),
    ]

    name = models.CharField(max_length=100, unique=True)
    quantity = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(decimal.Decimal('0.00'))]
    )
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='pcs')
    min_stock_threshold = models.DecimalField(
        max_digits=10, decimal_places=2, default=5.0,
        help_text='Alert when stock drops below this level'
    )
    cost_per_unit = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Inventory Item'
        verbose_name_plural = 'Inventory Items'

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"

    @property
    def is_low_stock(self):
        return self.quantity <= self.min_stock_threshold

    @property
    def stock_status(self):
        if self.quantity <= 0:
            return 'out_of_stock'
        elif self.is_low_stock:
            return 'low_stock'
        return 'in_stock'


# ─────────────────────────────────────────────
# MENU
# ─────────────────────────────────────────────

class MenuItem(models.Model):
    """Restaurant menu item with category and pricing."""
    CATEGORY_CHOICES = [
        ('starter', 'Starters'),
        ('main', 'Main Course'),
        ('dessert', 'Desserts'),
        ('beverage', 'Beverages'),
        ('side', 'Side Dishes'),
        ('special', 'Chef Specials'),
    ]

    name = models.CharField(max_length=150)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='main')
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(decimal.Decimal('0.01'))])
    image_url = models.CharField(max_length=500, blank=True, default='')
    is_available = models.BooleanField(default=True)
    is_vegetarian = models.BooleanField(default=False)
    spice_level = models.IntegerField(default=0, choices=[(0, 'None'), (1, 'Mild'), (2, 'Medium'), (3, 'Hot')])
    prep_time_minutes = models.IntegerField(default=15)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        verbose_name = 'Menu Item'
        verbose_name_plural = 'Menu Items'

    def __str__(self):
        return f"{self.name} (${self.price})"

    def check_availability(self):
        """Dynamically check if all ingredients are sufficiently stocked."""
        for ingredient_link in self.ingredients.all():
            if ingredient_link.inventory_item.quantity < ingredient_link.required_quantity:
                return False
        return True

    def sync_availability(self):
        """Update is_available based on current ingredient stock."""
        available = self.check_availability()
        if self.is_available != available:
            self.is_available = available
            self.save(update_fields=['is_available'])
        return available


class MenuItemIngredient(models.Model):
    """Links a menu item to required inventory ingredients."""
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='ingredients')
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='used_in')
    required_quantity = models.DecimalField(
        max_digits=8, decimal_places=2,
        validators=[MinValueValidator(decimal.Decimal('0.001'))]
    )

    class Meta:
        unique_together = ['menu_item', 'inventory_item']
        verbose_name = 'Menu Item Ingredient'
        verbose_name_plural = 'Menu Item Ingredients'

    def __str__(self):
        return f"{self.menu_item.name} needs {self.required_quantity} {self.inventory_item.unit} of {self.inventory_item.name}"


# ─────────────────────────────────────────────
# TABLES
# ─────────────────────────────────────────────

class RestaurantTable(models.Model):
    """Physical restaurant table with status tracking."""
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('occupied', 'Occupied'),
        ('reserved', 'Reserved'),
        ('maintenance', 'Under Maintenance'),
    ]

    LOCATION_CHOICES = [
        ('indoor', 'Indoor'),
        ('outdoor', 'Outdoor Terrace'),
        ('private', 'Private Dining'),
        ('bar', 'Bar Area'),
        ('window', 'Window Side'),
    ]

    table_number = models.IntegerField(unique=True)
    capacity = models.IntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, default='indoor')
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['table_number']
        verbose_name = 'Restaurant Table'
        verbose_name_plural = 'Restaurant Tables'

    def __str__(self):
        return f"Table {self.table_number} ({self.capacity} seats) - {self.status}"

    @property
    def is_available(self):
        return self.status == 'available'


# ─────────────────────────────────────────────
# RESERVATIONS
# ─────────────────────────────────────────────

class Reservation(models.Model):
    """Customer table reservations."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('seated', 'Seated'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]

    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=20, blank=True)
    customer_email = models.EmailField(blank=True)
    num_guests = models.IntegerField(validators=[MinValueValidator(1)])
    reservation_time = models.DateTimeField()
    duration_minutes = models.IntegerField(default=90)
    table = models.ForeignKey(RestaurantTable, on_delete=models.SET_NULL, null=True, blank=True, related_name='reservations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')
    special_requests = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-reservation_time']
        verbose_name = 'Reservation'
        verbose_name_plural = 'Reservations'

    def __str__(self):
        return f"{self.customer_name} - {self.reservation_time.strftime('%Y-%m-%d %H:%M')} ({self.num_guests} guests)"

    @property
    def end_time(self):
        from datetime import timedelta
        return self.reservation_time + timedelta(minutes=self.duration_minutes)


# ─────────────────────────────────────────────
# ORDERS
# ─────────────────────────────────────────────

class Order(models.Model):
    """Customer order tied to a table."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready to Serve'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('paid', 'Paid'),
        ('refunded', 'Refunded'),
    ]

    table = models.ForeignKey(RestaurantTable, on_delete=models.SET_NULL, null=True, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'

    def __str__(self):
        return f"Order #{self.id} | Table {self.table.table_number if self.table else 'N/A'} | {self.status}"

    def calculate_total(self):
        """Recalculate total from all order items."""
        total = sum(item.subtotal for item in self.items.all())
        self.total_amount = total
        self.save(update_fields=['total_amount'])
        return total


class OrderItem(models.Model):
    """Single line item within an order."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.SET_NULL, null=True, related_name='order_items')
    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    price_at_order = models.DecimalField(max_digits=8, decimal_places=2)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name = 'Order Item'
        verbose_name_plural = 'Order Items'

    def __str__(self):
        return f"{self.quantity}x {self.menu_item.name if self.menu_item else 'Deleted Item'} @ ${self.price_at_order}"

    @property
    def subtotal(self):
        return self.quantity * self.price_at_order


# ─────────────────────────────────────────────
# FOOD WASTE TRACKING
# ─────────────────────────────────────────────

class FoodWasteLog(models.Model):
    """Admin records wasted inventory for analytics and cost tracking."""
    REASON_CHOICES = [
        ('expired', 'Expired'),
        ('overcooked', 'Overcooked'),
        ('spilled', 'Spilled/Damaged'),
        ('quality', 'Quality Rejected'),
        ('other', 'Other'),
    ]

    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='waste_logs')
    quantity_wasted = models.DecimalField(
        max_digits=8, decimal_places=2,
        validators=[MinValueValidator(decimal.Decimal('0.001'))]
    )
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, default='other')
    estimated_cost = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True)
    logged_at = models.DateTimeField(auto_now_add=True)
    logged_by = models.CharField(max_length=100, default='Admin')

    class Meta:
        ordering = ['-logged_at']
        verbose_name = 'Food Waste Log'
        verbose_name_plural = 'Food Waste Logs'

    def __str__(self):
        return f"Waste: {self.quantity_wasted} {self.inventory_item.unit} of {self.inventory_item.name} ({self.reason})"

    def save(self, *args, **kwargs):
        # Auto-calculate estimated cost
        if self.inventory_item and not self.estimated_cost:
            self.estimated_cost = self.quantity_wasted * self.inventory_item.cost_per_unit
        super().save(*args, **kwargs)
