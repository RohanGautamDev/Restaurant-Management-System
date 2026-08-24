"""
DineMind AI - Database Seeder
Populates realistic sample data for portfolio demonstration.
Usage: python manage.py seed_db
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import random
from decimal import Decimal


class Command(BaseCommand):
    help = 'Seed the database with realistic sample restaurant data'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.MIGRATE_HEADING('\nDineMind AI - Seeding Database...\n'))

        self._create_superuser()
        inventory = self._create_inventory()
        menu_items = self._create_menu_items(inventory)
        tables = self._create_tables()
        self._create_reservations(tables)
        self._create_orders(tables, menu_items, inventory)
        self._create_waste_logs(inventory)

        self.stdout.write(self.style.SUCCESS('\n[OK] Database seeded successfully!\n'))
        self.stdout.write(self.style.WARNING('   Admin URL: http://127.0.0.1:8000/admin/'))
        self.stdout.write(self.style.WARNING('   Username: admin | Password: admin123\n'))

    def _create_superuser(self):
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@dinemind.ai', 'admin123')
            self.stdout.write(self.style.SUCCESS('  [+] Superuser created (admin / admin123)'))
        else:
            self.stdout.write('  [-] Superuser already exists')

    def _create_inventory(self):
        from restaurant.models import InventoryItem

        items_data = [
            # Proteins
            ('Chicken Breast', 45.0, 'kg', 8.0, 5.50),
            ('Beef Tenderloin', 20.0, 'kg', 5.0, 18.00),
            ('Salmon Fillet', 15.0, 'kg', 4.0, 22.00),
            ('Shrimp', 12.0, 'kg', 3.0, 14.00),
            ('Eggs', 120.0, 'pcs', 24.0, 0.30),
            ('Paneer', 8.0, 'kg', 2.0, 7.00),

            # Produce
            ('Lettuce', 10.0, 'kg', 2.0, 2.00),
            ('Tomatoes', 15.0, 'kg', 3.0, 1.80),
            ('Onions', 20.0, 'kg', 4.0, 0.80),
            ('Garlic', 5.0, 'kg', 1.0, 3.50),
            ('Bell Peppers', 8.0, 'kg', 2.0, 3.00),
            ('Mushrooms', 6.0, 'kg', 1.5, 6.00),
            ('Spinach', 5.0, 'kg', 1.0, 3.20),
            ('Avocado', 20.0, 'pcs', 6.0, 1.50),

            # Dairy
            ('Butter', 8.0, 'kg', 2.0, 9.00),
            ('Heavy Cream', 10.0, 'l', 2.0, 4.50),
            ('Parmesan Cheese', 4.0, 'kg', 1.0, 20.00),
            ('Mozzarella', 6.0, 'kg', 1.5, 12.00),
            ('Milk', 20.0, 'l', 4.0, 1.20),

            # Dry goods
            ('Pasta', 15.0, 'kg', 3.0, 2.50),
            ('Rice', 25.0, 'kg', 5.0, 1.80),
            ('Bread Crumbs', 5.0, 'kg', 1.0, 2.00),
            ('All-Purpose Flour', 20.0, 'kg', 5.0, 1.20),
            ('Olive Oil', 8.0, 'l', 2.0, 8.00),

            # Beverages
            ('Coffee Beans', 3.0, 'kg', 0.5, 25.00),
            ('Tea Leaves', 2.0, 'kg', 0.3, 18.00),
            ('Orange Juice', 15.0, 'l', 3.0, 2.80),
            ('Sparkling Water', 50.0, 'pcs', 10.0, 0.80),
            ('Chocolate', 4.0, 'kg', 1.0, 12.00),
            ('Sugar', 10.0, 'kg', 2.0, 1.00),
            ('Vanilla Extract', 1.0, 'l', 0.2, 30.00),
        ]

        inventory_map = {}
        created = 0
        for name, qty, unit, threshold, cost in items_data:
            obj, was_created = InventoryItem.objects.get_or_create(
                name=name,
                defaults={
                    'quantity': Decimal(str(qty)),
                    'unit': unit,
                    'min_stock_threshold': Decimal(str(threshold)),
                    'cost_per_unit': Decimal(str(cost)),
                }
            )
            inventory_map[name] = obj
            if was_created:
                created += 1

        # Force a few items to be low stock for realism
        low_stock_items = ['Salmon Fillet', 'Parmesan Cheese', 'Vanilla Extract']
        for name in low_stock_items:
            if name in inventory_map:
                item = inventory_map[name]
                item.quantity = item.min_stock_threshold - Decimal('0.5')
                item.save()

        self.stdout.write(self.style.SUCCESS(f'  [OK] {created} inventory items created ({len(inventory_map)} total)'))
        return inventory_map

    def _create_menu_items(self, inventory):
        from restaurant.models import MenuItem, MenuItemIngredient

        menu_data = [
            # STARTERS
            {
                'name': 'Crispy Calamari',
                'category': 'starter',
                'price': 14.99,
                'description': 'Golden-fried squid rings with marinara sauce and lemon aioli.',
                'is_vegetarian': False,
                'spice_level': 1,
                'prep_time_minutes': 12,
                'image_url': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400',
                'ingredients': [('Bread Crumbs', 0.1), ('Olive Oil', 0.05), ('Eggs', 2)],
            },
            {
                'name': 'Bruschetta al Pomodoro',
                'category': 'starter',
                'price': 11.99,
                'description': 'Toasted artisan bread with fresh tomatoes, basil, and extra virgin olive oil.',
                'is_vegetarian': True,
                'spice_level': 0,
                'prep_time_minutes': 8,
                'image_url': 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400',
                'ingredients': [('Tomatoes', 0.15), ('Olive Oil', 0.03), ('Garlic', 0.02)],
            },
            {
                'name': 'Mushroom Arancini',
                'category': 'starter',
                'price': 13.50,
                'description': 'Crispy risotto balls stuffed with wild mushrooms and truffle parmesan.',
                'is_vegetarian': True,
                'spice_level': 0,
                'prep_time_minutes': 20,
                'image_url': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
                'ingredients': [('Rice', 0.1), ('Mushrooms', 0.1), ('Parmesan Cheese', 0.05), ('Eggs', 1)],
            },
            {
                'name': 'Shrimp Cocktail',
                'category': 'starter',
                'price': 18.99,
                'description': 'Chilled jumbo shrimp with spicy cocktail sauce and fresh horseradish.',
                'is_vegetarian': False,
                'spice_level': 2,
                'prep_time_minutes': 10,
                'image_url': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
                'ingredients': [('Shrimp', 0.2), ('Tomatoes', 0.05)],
            },

            # MAIN COURSE
            {
                'name': 'Grilled Salmon Supreme',
                'category': 'main',
                'price': 34.99,
                'description': 'Pan-seared Atlantic salmon with lemon butter sauce, capers, and seasonal vegetables.',
                'is_vegetarian': False,
                'spice_level': 1,
                'prep_time_minutes': 25,
                'image_url': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400',
                'ingredients': [('Salmon Fillet', 0.25), ('Butter', 0.05), ('Heavy Cream', 0.1), ('Spinach', 0.1)],
            },
            {
                'name': 'Beef Tenderloin Medallions',
                'category': 'main',
                'price': 48.00,
                'description': 'Prime beef tenderloin with red wine reduction, truffle mash, and roasted vegetables.',
                'is_vegetarian': False,
                'spice_level': 1,
                'prep_time_minutes': 30,
                'image_url': 'https://images.unsplash.com/photo-1558030006-450675393462?w=400',
                'ingredients': [('Beef Tenderloin', 0.3), ('Butter', 0.05), ('Mushrooms', 0.1), ('Garlic', 0.02)],
            },
            {
                'name': 'Chicken Milanese',
                'category': 'main',
                'price': 26.99,
                'description': 'Breaded chicken breast with arugula salad, cherry tomatoes, and shaved parmesan.',
                'is_vegetarian': False,
                'spice_level': 0,
                'prep_time_minutes': 20,
                'image_url': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400',
                'ingredients': [('Chicken Breast', 0.25), ('Bread Crumbs', 0.1), ('Eggs', 1), ('Parmesan Cheese', 0.05), ('Lettuce', 0.08)],
            },
            {
                'name': 'Truffle Pasta Carbonara',
                'category': 'main',
                'price': 28.50,
                'description': 'House-made tagliatelle with guanciale, egg yolk, Pecorino Romano, and black truffle.',
                'is_vegetarian': False,
                'spice_level': 0,
                'prep_time_minutes': 18,
                'image_url': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400',
                'ingredients': [('Pasta', 0.15), ('Eggs', 2), ('Parmesan Cheese', 0.08), ('Heavy Cream', 0.05)],
            },
            {
                'name': 'Paneer Tikka Masala',
                'category': 'main',
                'price': 22.99,
                'description': 'Marinated cottage cheese in aromatic tomato-cream sauce with fragrant basmati rice.',
                'is_vegetarian': True,
                'spice_level': 2,
                'prep_time_minutes': 22,
                'image_url': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',
                'ingredients': [('Paneer', 0.2), ('Tomatoes', 0.15), ('Heavy Cream', 0.1), ('Onions', 0.1), ('Garlic', 0.02), ('Rice', 0.1)],
            },
            {
                'name': 'Mediterranean Sea Bass',
                'category': 'main',
                'price': 38.00,
                'description': 'Whole sea bass with olives, capers, tomatoes, herbs, and extra-virgin olive oil.',
                'is_vegetarian': False,
                'spice_level': 1,
                'prep_time_minutes': 28,
                'image_url': 'https://images.unsplash.com/photo-1510130387422-82bed34b37e9?w=400',
                'ingredients': [('Salmon Fillet', 0.3), ('Olive Oil', 0.05), ('Tomatoes', 0.1), ('Bell Peppers', 0.1)],
            },

            # DESSERTS
            {
                'name': 'Chocolate Lava Cake',
                'category': 'dessert',
                'price': 12.99,
                'description': 'Warm dark chocolate fondant with a molten center, served with vanilla ice cream.',
                'is_vegetarian': True,
                'spice_level': 0,
                'prep_time_minutes': 15,
                'image_url': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400',
                'ingredients': [('Chocolate', 0.1), ('Butter', 0.05), ('Eggs', 2), ('All-Purpose Flour', 0.03), ('Sugar', 0.06)],
            },
            {
                'name': 'Tiramisu Classico',
                'category': 'dessert',
                'price': 10.99,
                'description': 'Traditional Italian tiramisu with mascarpone, espresso, and Savoiardi biscuits.',
                'is_vegetarian': True,
                'spice_level': 0,
                'prep_time_minutes': 10,
                'image_url': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
                'ingredients': [('Coffee Beans', 0.02), ('Eggs', 2), ('Sugar', 0.05), ('Chocolate', 0.03)],
            },
            {
                'name': 'Crème Brûlée',
                'category': 'dessert',
                'price': 11.50,
                'description': 'Classic French custard with a perfectly caramelised sugar crust and fresh berries.',
                'is_vegetarian': True,
                'spice_level': 0,
                'prep_time_minutes': 20,
                'image_url': 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=400',
                'ingredients': [('Heavy Cream', 0.2), ('Eggs', 3), ('Sugar', 0.05), ('Vanilla Extract', 0.01)],
            },

            # BEVERAGES
            {
                'name': 'Artisan Cold Brew Coffee',
                'category': 'beverage',
                'price': 6.50,
                'description': '18-hour steeped cold brew coffee, smooth with natural caramel notes.',
                'is_vegetarian': True,
                'spice_level': 0,
                'prep_time_minutes': 3,
                'image_url': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400',
                'ingredients': [('Coffee Beans', 0.02), ('Milk', 0.1)],
            },
            {
                'name': 'Fresh Squeezed Orange Juice',
                'category': 'beverage',
                'price': 5.00,
                'description': 'Freshly pressed seasonal oranges, served chilled.',
                'is_vegetarian': True,
                'spice_level': 0,
                'prep_time_minutes': 2,
                'image_url': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400',
                'ingredients': [('Orange Juice', 0.3)],
            },
            {
                'name': 'Sparkling Mineral Water',
                'category': 'beverage',
                'price': 4.00,
                'description': 'Premium sparkling mineral water with lemon wheel.',
                'is_vegetarian': True,
                'spice_level': 0,
                'prep_time_minutes': 1,
                'image_url': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
                'ingredients': [('Sparkling Water', 1)],
            },

            # CHEF SPECIALS
            {
                'name': 'Chef\'s Tasting Menu (5 Courses)',
                'category': 'special',
                'price': 95.00,
                'description': "Executive Chef's daily curated five-course tasting experience with wine pairing suggestions.",
                'is_vegetarian': False,
                'spice_level': 1,
                'prep_time_minutes': 90,
                'image_url': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400',
                'ingredients': [
                    ('Salmon Fillet', 0.15), ('Beef Tenderloin', 0.2), ('Heavy Cream', 0.15),
                    ('Chocolate', 0.08), ('Butter', 0.08)
                ],
            },
        ]

        created_items = []
        created = 0
        for data in menu_data:
            ingredients = data.pop('ingredients', [])
            item, was_created = MenuItem.objects.get_or_create(
                name=data['name'],
                defaults={**data}
            )
            if was_created:
                created += 1
                # Link ingredients
                for inv_name, qty in ingredients:
                    inv_item = inventory.get(inv_name)
                    if inv_item:
                        MenuItemIngredient.objects.get_or_create(
                            menu_item=item,
                            inventory_item=inv_item,
                            defaults={'required_quantity': Decimal(str(qty))}
                        )
            created_items.append(item)

        # Sync availability based on inventory
        for item in created_items:
            item.sync_availability()

        self.stdout.write(self.style.SUCCESS(f'  [OK] {created} menu items created ({len(created_items)} total)'))
        return created_items

    def _create_tables(self):
        from restaurant.models import RestaurantTable

        tables_data = [
            (1, 2, 'window', 'available'),
            (2, 2, 'window', 'available'),
            (3, 4, 'indoor', 'occupied'),
            (4, 4, 'indoor', 'available'),
            (5, 4, 'indoor', 'available'),
            (6, 6, 'indoor', 'reserved'),
            (7, 6, 'indoor', 'available'),
            (8, 8, 'private', 'available'),
            (9, 8, 'private', 'available'),
            (10, 10, 'private', 'available'),
            (11, 2, 'outdoor', 'available'),
            (12, 4, 'outdoor', 'occupied'),
            (13, 4, 'outdoor', 'available'),
            (14, 6, 'bar', 'available'),
            (15, 4, 'bar', 'reserved'),
        ]

        tables = []
        created = 0
        for num, cap, loc, st in tables_data:
            t, was_created = RestaurantTable.objects.get_or_create(
                table_number=num,
                defaults={'capacity': cap, 'location': loc, 'status': st}
            )
            tables.append(t)
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  [OK] {created} tables created ({len(tables)} total)'))
        return tables

    def _create_reservations(self, tables):
        from restaurant.models import Reservation

        now = timezone.now()
        reservations_data = [
            {
                'customer_name': 'James Thornton',
                'customer_phone': '+1-555-0101',
                'customer_email': 'james.t@email.com',
                'num_guests': 2,
                'reservation_time': now + timedelta(hours=3),
                'table': tables[0],
                'status': 'confirmed',
                'special_requests': 'Anniversary dinner - rose petals if possible',
            },
            {
                'customer_name': 'Sophia Chen',
                'customer_phone': '+1-555-0102',
                'customer_email': 'sophia.chen@email.com',
                'num_guests': 6,
                'reservation_time': now + timedelta(hours=5),
                'table': tables[5],
                'status': 'confirmed',
                'special_requests': 'Birthday celebration for corporate team',
            },
            {
                'customer_name': 'Marcus Williams',
                'customer_phone': '+1-555-0103',
                'customer_email': 'marcus.w@email.com',
                'num_guests': 4,
                'reservation_time': now + timedelta(days=1, hours=6),
                'table': tables[3],
                'status': 'confirmed',
                'special_requests': '',
            },
            {
                'customer_name': 'Isabella Ferrari',
                'customer_phone': '+1-555-0104',
                'customer_email': 'isabella.f@email.com',
                'num_guests': 4,
                'reservation_time': now + timedelta(hours=7),
                'table': tables[14],
                'status': 'confirmed',
                'special_requests': 'Vegetarian menu preference',
            },
            {
                'customer_name': 'David Park',
                'customer_phone': '+1-555-0105',
                'customer_email': '',
                'num_guests': 8,
                'reservation_time': now + timedelta(days=2),
                'table': tables[7],
                'status': 'confirmed',
                'special_requests': 'Business dinner - projector setup needed',
            },
        ]

        created = 0
        for rd in reservations_data:
            if not Reservation.objects.filter(
                customer_name=rd['customer_name'],
                reservation_time=rd['reservation_time']
            ).exists():
                Reservation.objects.create(**rd)
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  [OK] {created} reservations created'))

    def _create_orders(self, tables, menu_items, inventory):
        from restaurant.models import Order, OrderItem
        import random

        # Create past completed orders for analytics
        now = timezone.now()
        occupied_tables = [t for t in tables if t.status == 'occupied']

        # Simulate 14 days of order history
        all_created = 0
        for day_offset in range(14, 0, -1):
            day_date = now - timedelta(days=day_offset)
            # Vary order count by simulated day
            num_orders = random.randint(8, 22)

            # Simulate peak hours
            hours = []
            for _ in range(num_orders):
                rand = random.random()
                if rand < 0.15:
                    hours.append(random.randint(12, 14))  # lunch peak
                elif rand < 0.60:
                    hours.append(random.randint(18, 21))  # dinner peak
                else:
                    hours.append(random.randint(10, 22))  # other

            for h in hours:
                table = random.choice(tables)
                num_items = random.randint(1, 4)
                chosen_items = random.sample(menu_items[:12], min(num_items, len(menu_items[:12])))
                total = Decimal('0')
                order_time = day_date.replace(hour=h, minute=random.randint(0, 59), second=0, microsecond=0)

                order = Order.objects.create(
                    table=table,
                    status='completed',
                    payment_status='paid',
                    total_amount=Decimal('0'),
                    created_at=order_time,
                )

                for mi in chosen_items:
                    qty = random.randint(1, 3)
                    OrderItem.objects.create(
                        order=order,
                        menu_item=mi,
                        quantity=qty,
                        price_at_order=mi.price
                    )
                    total += mi.price * Decimal(str(qty))

                order.total_amount = total
                order.save(update_fields=['total_amount'])
                all_created += 1

        # Create active orders on occupied tables
        available_items = [m for m in menu_items if m.is_available]
        for table in occupied_tables:
            if available_items:
                chosen = random.sample(available_items, min(3, len(available_items)))
                total = Decimal('0')
                order = Order.objects.create(
                    table=table,
                    status='preparing',
                    payment_status='unpaid',
                    total_amount=Decimal('0'),
                )
                for mi in chosen:
                    qty = random.randint(1, 2)
                    OrderItem.objects.create(
                        order=order,
                        menu_item=mi,
                        quantity=qty,
                        price_at_order=mi.price
                    )
                    total += mi.price * Decimal(str(qty))
                order.total_amount = total
                order.save(update_fields=['total_amount'])
                all_created += 1

        self.stdout.write(self.style.SUCCESS(f'  [OK] {all_created} orders created (14 days history + active orders)'))

    def _create_waste_logs(self, inventory):
        from restaurant.models import FoodWasteLog

        waste_data = [
            ('Lettuce', 0.5, 'expired', 'Lettuce wilted - not used in time'),
            ('Salmon Fillet', 0.3, 'quality', 'Quality check failed - discoloration'),
            ('Heavy Cream', 0.5, 'expired', 'Past use-by date'),
            ('Bread Crumbs', 0.2, 'spilled', 'Kitchen accident'),
            ('Tomatoes', 0.8, 'expired', 'Batch left over from weekend prep'),
            ('Mushrooms', 0.4, 'overcooked', 'Over-prepped for service that slowed down'),
        ]

        created = 0
        for item_name, qty, reason, notes in waste_data:
            inv_item = inventory.get(item_name)
            if inv_item:
                FoodWasteLog.objects.create(
                    inventory_item=inv_item,
                    quantity_wasted=Decimal(str(qty)),
                    reason=reason,
                    notes=notes,
                    estimated_cost=Decimal(str(qty)) * inv_item.cost_per_unit,
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  [OK] {created} food waste entries created'))
