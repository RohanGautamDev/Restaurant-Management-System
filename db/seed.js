/**
 * DineMind AI — db/seed.js
 * Database population script (Inventory, Menu, Recipes, Tables, Reservations, Orders, Waste)
 */

'use strict';

const { db, syncMenuAvailability } = require('./database');

function seedDatabase() {
  console.log('[SEED] Clearing existing records...');
  db.exec(`
    DELETE FROM food_waste_logs;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM reservations;
    DELETE FROM restaurant_tables;
    DELETE FROM menu_item_ingredients;
    DELETE FROM menu_items;
    DELETE FROM inventory_items;
  `);

  console.log('[SEED] Inserting 31 Inventory Items...');
  const insertInventory = db.prepare(`
    INSERT INTO inventory_items (name, category, quantity, unit, min_stock_threshold, cost_per_unit, supplier_name, supplier_contact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const inventoryData = [
    // Proteins
    ['Chicken Breast', 'meat', 25.0, 'kg', 5.0, 6.50, 'Prime Poultry Co', 'poultry@prime.com'],
    ['Prime Beef Ribeye', 'meat', 18.0, 'kg', 4.0, 18.00, 'Heritage Meats', 'sales@heritagemeats.com'],
    ['Atlantic Salmon Fillet', 'seafood', 12.0, 'kg', 3.0, 14.00, 'Ocean Fresh Catch', 'orders@oceanfresh.com'],
    ['Tiger Prawns', 'seafood', 8.0, 'kg', 2.0, 16.50, 'Ocean Fresh Catch', 'orders@oceanfresh.com'],
    ['Eggs (Large)', 'dairy', 120.0, 'units', 30.0, 0.25, 'Sunrise Farms', 'info@sunrisefarms.com'],
    ['Tofu (Firm Organic)', 'produce', 10.0, 'kg', 2.0, 3.50, 'Green Earth Organics', 'orders@greenearth.com'],

    // Produce
    ['Roma Tomatoes', 'produce', 20.0, 'kg', 5.0, 2.20, 'Valley Produce Ltd', 'orders@valleyproduce.com'],
    ['Yellow Onions', 'produce', 30.0, 'kg', 8.0, 1.10, 'Valley Produce Ltd', 'orders@valleyproduce.com'],
    ['Garlic Bulbs', 'produce', 5.0, 'kg', 1.0, 4.00, 'Valley Produce Ltd', 'orders@valleyproduce.com'],
    ['Baby Spinach', 'produce', 6.0, 'kg', 2.0, 4.50, 'Green Earth Organics', 'orders@greenearth.com'],
    ['Portobello Mushrooms', 'produce', 8.0, 'kg', 2.0, 5.80, 'Fungi Direct', 'contact@fungidirect.com'],
    ['Fresh Basil', 'produce', 2.0, 'kg', 0.5, 8.00, 'Urban Herb Garden', 'herbs@urbanherb.com'],
    ['Lemons', 'produce', 15.0, 'kg', 3.0, 2.50, 'Valley Produce Ltd', 'orders@valleyproduce.com'],
    ['Avocado', 'produce', 4.0, 'kg', 3.0, 6.00, 'Valley Produce Ltd', 'orders@valleyproduce.com'],

    // Dairy
    ['Heavy Cream 35%', 'dairy', 12.0, 'liters', 3.0, 4.20, 'Dairy Crest Farm', 'dairy@dairycrest.com'],
    ['Parmigiano Reggiano', 'dairy', 8.0, 'kg', 2.0, 22.00, 'Italian Imports Co', 'import@italianco.com'],
    ['Fresh Mozzarella', 'dairy', 7.0, 'kg', 2.0, 9.50, 'Italian Imports Co', 'import@italianco.com'],
    ['Unsalted Butter', 'dairy', 14.0, 'kg', 3.0, 7.00, 'Dairy Crest Farm', 'dairy@dairycrest.com'],
    ['Whole Milk', 'dairy', 20.0, 'liters', 5.0, 1.40, 'Dairy Crest Farm', 'dairy@dairycrest.com'],

    // Dry / Pantry
    ['Arborio Rice', 'dry', 25.0, 'kg', 5.0, 3.20, 'Pantry Staples Direct', 'sales@pantrystaples.com'],
    ['Basmati Rice', 'dry', 40.0, 'kg', 10.0, 2.80, 'Pantry Staples Direct', 'sales@pantrystaples.com'],
    ['Spaghetti (Bronze Die)', 'dry', 20.0, 'kg', 4.0, 2.40, 'Italian Imports Co', 'import@italianco.com'],
    ['Extra Virgin Olive Oil', 'dry', 15.0, 'liters', 4.0, 11.00, 'Mediterranean Oils', 'orders@medoils.com'],
    ['Dark Chocolate 70%', 'dry', 6.0, 'kg', 2.0, 15.00, 'Chocolatier Supplies', 'info@chocsupplies.com'],
    ['All-Purpose Flour', 'dry', 50.0, 'kg', 10.0, 1.00, 'Pantry Staples Direct', 'sales@pantrystaples.com'],
    ['Cane Sugar', 'dry', 30.0, 'kg', 5.0, 1.20, 'Pantry Staples Direct', 'sales@pantrystaples.com'],

    // Beverages & Bar
    ['Espresso Beans (Single Origin)', 'beverage', 8.0, 'kg', 2.0, 24.00, 'Artisan Roasters', 'orders@artisanroasters.com'],
    ['Matcha Green Tea Powder', 'beverage', 1.5, 'kg', 0.5, 45.00, 'Kyoto Imports', 'info@kyotoimports.com'],
    ['Mineral Water (Sparkling 750ml)', 'beverage', 48.0, 'units', 12.0, 1.50, 'Alpine Springs', 'contact@alpinesprings.com'],
    ['Fresh Mint Leaves', 'produce', 1.2, 'kg', 0.5, 9.00, 'Urban Herb Garden', 'herbs@urbanherb.com'],
    ['Sparkling Tonic Water', 'beverage', 36.0, 'units', 12.0, 1.10, 'Mixology Depot', 'orders@mixologydepot.com'],
  ];

  const inventoryIdMap = {};
  for (const item of inventoryData) {
    const info = insertInventory.run(...item);
    inventoryIdMap[item[0]] = info.lastInsertRowid;
  }

  console.log('[SEED] Inserting 17 Menu Items & Recipe Mappings...');
  const insertMenu = db.prepare(`
    INSERT INTO menu_items (name, category, price, description, is_available, image_url, is_vegetarian, prep_time_minutes, spice_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertIngredient = db.prepare(`
    INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, quantity_required)
    VALUES (?, ?, ?)
  `);

  const menuData = [
    // Starters
    ['Bruschetta al Pomodoro', 'starter', 12.50, 'Toasted sourdough with vine ripe tomatoes, fresh basil, garlic, and EVOO.', 1, '/static/images/bruschetta.jpg', 1, 10, 0, [
      ['Roma Tomatoes', 0.15], ['Fresh Basil', 0.02], ['Garlic Bulbs', 0.01], ['Extra Virgin Olive Oil', 0.03]
    ]],
    ['Crispy Calamari & Tiger Prawns', 'starter', 16.00, 'Flash-fried tiger prawns and calamari rings with lemon garlic aioli.', 1, 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80', 0, 12, 1, [
      ['Tiger Prawns', 0.18], ['Lemons', 0.05], ['Garlic Bulbs', 0.01], ['All-Purpose Flour', 0.05]
    ]],
    ['Truffle Wild Mushroom Medley', 'starter', 14.50, 'Pan-seared portobello and forest mushrooms with fresh herbs on brioche.', 1, 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&auto=format&fit=crop&q=80', 1, 12, 0, [
      ['Portobello Mushrooms', 0.20], ['Unsalted Butter', 0.03], ['Garlic Bulbs', 0.01], ['Fresh Basil', 0.01]
    ]],
    ['Avocado & Citrus Caprese', 'starter', 13.50, 'Fresh buffalo mozzarella, sliced avocado, ripe tomatoes with balsamic glaze.', 1, 'https://images.unsplash.com/photo-1592417817098-8f3d69102a56?w=600&auto=format&fit=crop&q=80', 1, 8, 0, [
      ['Fresh Mozzarella', 0.12], ['Avocado', 0.15], ['Roma Tomatoes', 0.12], ['Fresh Basil', 0.02]
    ]],

    // Mains
    ['Charcoal Grilled Ribeye Steak', 'main', 38.00, 'Prime USDA ribeye steak, roasted garlic compound butter, truffle fries.', 1, '/static/images/ribeye_steak.jpg', 0, 22, 0, [
      ['Prime Beef Ribeye', 0.35], ['Unsalted Butter', 0.04], ['Garlic Bulbs', 0.02]
    ]],
    ['Pan-Seared Atlantic Salmon', 'main', 29.50, 'Crispy skin salmon fillet over saffron arborio risotto and baby spinach.', 1, '/static/images/salmon.jpg', 0, 18, 0, [
      ['Atlantic Salmon Fillet', 0.22], ['Arborio Rice', 0.08], ['Baby Spinach', 0.06], ['Heavy Cream 35%', 0.04], ['Unsalted Butter', 0.02]
    ]],
    ['Classic Chicken Parmigiana', 'main', 24.50, 'Breaded chicken breast baked with San Marzano sauce and aged mozzarella.', 1, 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=600&auto=format&fit=crop&q=80', 0, 18, 0, [
      ['Chicken Breast', 0.25], ['Roma Tomatoes', 0.15], ['Fresh Mozzarella', 0.08], ['Parmigiano Reggiano', 0.03], ['All-Purpose Flour', 0.04]
    ]],
    ['Wild Mushroom & Truffle Risotto', 'main', 23.00, 'Slow-simmered Carnaroli rice with portobello mushrooms and 24-month parmesan.', 1, 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=600&auto=format&fit=crop&q=80', 1, 20, 0, [
      ['Arborio Rice', 0.12], ['Portobello Mushrooms', 0.15], ['Parmigiano Reggiano', 0.04], ['Unsalted Butter', 0.03], ['Heavy Cream 35%', 0.03]
    ]],
    ['Handmade Spaghetti Carbonara', 'main', 22.00, 'Traditional Roman carbonara with egg yolk emulsion, black pepper, and pecorino.', 1, 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80', 0, 15, 1, [
      ['Spaghetti (Bronze Die)', 0.15], ['Eggs (Large)', 2], ['Parmigiano Reggiano', 0.04], ['Unsalted Butter', 0.02]
    ]],
    ['Royal Chicken Dum Biryani', 'main', 25.00, 'Slow-cooked fragrant basmati rice with tender chicken, whole spices, and saffron.', 1, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80', 0, 25, 2, [
      ['Chicken Breast', 0.28], ['Basmati Rice', 0.16], ['Yellow Onions', 0.10], ['Unsalted Butter', 0.03], ['Garlic Bulbs', 0.02]
    ]],

    // Desserts
    ['Pure Chocolate Bal Mithai', 'dessert', 14.00, 'Authentic Himalayan desi fudge-like sweet made with roasted khoya, cocoa, and coated with sugar pearls.', 1, '/static/images/bal_mithai.jpg', 1, 10, 0, [
      ['Cane Sugar', 0.10], ['Whole Milk', 0.20], ['Dark Chocolate 70%', 0.05]
    ]],
    ['Classic Venetian Tiramisu', 'dessert', 10.50, 'Espresso-soaked savoiardi biscuits layered with mascarpone and cocoa.', 1, '/static/images/tiramisu.jpg', 1, 5, 0, [
      ['Espresso Beans (Single Origin)', 0.03], ['Eggs (Large)', 2], ['Heavy Cream 35%', 0.08], ['Cane Sugar', 0.04]
    ]],
    ['Warm Molten Chocolate Lava Cake', 'dessert', 11.50, '70% Valrhona dark chocolate cake with liquid center and vanilla gelato.', 1, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80', 1, 14, 0, [
      ['Dark Chocolate 70%', 0.09], ['Unsalted Butter', 0.04], ['Eggs (Large)', 2], ['All-Purpose Flour', 0.02], ['Cane Sugar', 0.03]
    ]],
    ['Madagascar Vanilla Panna Cotta', 'dessert', 9.50, 'Silky cream infused with vanilla bean and fresh berry coulis.', 1, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80', 1, 5, 0, [
      ['Heavy Cream 35%', 0.12], ['Whole Milk', 0.06], ['Cane Sugar', 0.03]
    ]],

    // Beverages
    ['DineMind Artisanal Cold Brew', 'beverage', 6.50, '18-hour steep single-origin Ethiopian cold brew with tonic or oat milk.', 1, 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80', 1, 3, 0, [
      ['Espresso Beans (Single Origin)', 0.04]
    ]],
    ['Matcha Mint Refresher', 'beverage', 7.50, 'Ceremonial Uji matcha shaken with fresh mint, lime, and sparkling water.', 1, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80', 1, 4, 0, [
      ['Matcha Green Tea Powder', 0.01], ['Fresh Mint Leaves', 0.02], ['Lemons', 0.03], ['Mineral Water (Sparkling 750ml)', 0.5]
    ]],
    ['San Pellegrino Sparkling (750ml)', 'beverage', 6.00, 'Imported sparkling natural mineral water.', 1, 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80', 1, 1, 0, [
      ['Mineral Water (Sparkling 750ml)', 1.0]
    ]],

    // Special
    ['Chef Tasting Signature Omakase', 'special', 65.00, 'Chef-curated 5-course seasonal culinary tasting experience.', 1, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', 0, 35, 1, [
      ['Prime Beef Ribeye', 0.18], ['Atlantic Salmon Fillet', 0.12], ['Tiger Prawns', 0.10], ['Portobello Mushrooms', 0.08], ['Arborio Rice', 0.06]
    ]],
  ];

  for (const m of menuData) {
    const [name, cat, price, desc, avail, img, veg, prep, spice, ingredients] = m;
    const res = insertMenu.run(name, cat, price, desc, avail, img, veg, prep, spice);
    const menuItemId = res.lastInsertRowid;

    for (const [ingName, qtyReq] of ingredients) {
      const invId = inventoryIdMap[ingName];
      if (invId) {
        insertIngredient.run(menuItemId, invId, qtyReq);
      }
    }
  }

  console.log('[SEED] Inserting 15 Restaurant Tables...');
  const insertTable = db.prepare(`
    INSERT INTO restaurant_tables (table_number, capacity, location, status)
    VALUES (?, ?, ?, ?)
  `);

  const tablesData = [
    [1, 2, 'indoor', 'available'],
    [2, 2, 'indoor', 'available'],
    [3, 4, 'indoor', 'occupied'],
    [4, 4, 'indoor', 'available'],
    [5, 6, 'indoor', 'available'],
    [6, 6, 'indoor', 'occupied'],
    [7, 2, 'outdoor', 'available'],
    [8, 4, 'outdoor', 'available'],
    [9, 4, 'outdoor', 'reserved'],
    [10, 8, 'private', 'available'],
    [11, 12, 'private', 'reserved'],
    [12, 2, 'bar', 'available'],
    [13, 2, 'bar', 'available'],
    [14, 4, 'window', 'available'],
    [15, 4, 'window', 'occupied'],
  ];

  const tableIdMap = {};
  for (const t of tablesData) {
    const res = insertTable.run(...t);
    tableIdMap[t[0]] = res.lastInsertRowid;
  }

  console.log('[SEED] Inserting 10 Reservations...');
  const insertReservation = db.prepare(`
    INSERT INTO reservations (customer_name, customer_phone, customer_email, table_id, num_guests, reservation_time, duration_minutes, status, special_requests)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const resList = [
    ['Elena Rostova', '+1-555-0101', 'elena.r@luxmail.com', tableIdMap[9], 4, new Date(now.getTime() + 3 * 3600000).toISOString(), 90, 'confirmed', 'Window side preferred, birthday celebration'],
    ['Marcus Vance', '+1-555-0102', 'm.vance@techcorp.io', tableIdMap[11], 10, new Date(now.getTime() + 5 * 3600000).toISOString(), 120, 'confirmed', 'Executive dinner, quiet area requested'],
    ['Sarah Jenkins', '+1-555-0103', 'sjenkins@gmail.com', tableIdMap[1], 2, new Date(now.getTime() + 24 * 3600000).toISOString(), 90, 'confirmed', 'Anniversary dinner setup'],
    ['Liam Chen', '+1-555-0104', 'chen.liam@outlook.com', tableIdMap[5], 6, new Date(now.getTime() + 26 * 3600000).toISOString(), 90, 'confirmed', 'High chair needed for 1 child'],
    ['Sofia Rodriguez', '+1-555-0105', 'sofia.rod@artstudio.com', tableIdMap[8], 4, new Date(now.getTime() + 48 * 3600000).toISOString(), 90, 'confirmed', 'Celebrating promotion'],
    ['David Miller', '+1-555-0106', 'dmiller@fastmail.com', tableIdMap[2], 2, new Date(now.getTime() - 24 * 3600000).toISOString(), 90, 'completed', ''],
    ['Aisha Patel', '+1-555-0107', 'aisha.p@globalnet.org', tableIdMap[4], 4, new Date(now.getTime() - 48 * 3600000).toISOString(), 90, 'completed', ''],
    ['Robert Taylor', '+1-555-0108', 'rtaylor@fintech.co', tableIdMap[10], 8, new Date(now.getTime() - 72 * 3600000).toISOString(), 120, 'completed', ''],
    ['Chloe Dupont', '+1-555-0109', 'chloe.d@designhaus.fr', tableIdMap[7], 2, new Date(now.getTime() - 96 * 3600000).toISOString(), 60, 'cancelled', 'Guest cancelled via phone'],
    ['James Wilson', '+1-555-0110', 'jwilson@apex.com', tableIdMap[3], 4, new Date(now.getTime() - 120 * 3600000).toISOString(), 90, 'completed', ''],
  ];

  for (const r of resList) {
    insertReservation.run(...r);
  }

  console.log('[SEED] Generating 14-day Historical Orders (188+ orders)...');
  const insertOrder = db.prepare(`
    INSERT INTO orders (table_id, status, total_amount, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
    VALUES (?, ?, ?, ?, ?)
  `);

  const allMenuItems = db.prepare('SELECT * FROM menu_items').all();
  const allTableIds = Object.values(tableIdMap);

  let totalOrdersCount = 0;

  // Generate historical orders across past 14 days
  for (let day = 13; day >= 0; day--) {
    const ordersPerDay = day === 0 ? 12 : Math.floor(Math.random() * 8) + 11; // 11-18 orders/day

    for (let o = 0; o < ordersPerDay; o++) {
      // Simulate peak hours: 12-14 (lunch) and 18-21 (dinner)
      let hour;
      const rand = Math.random();
      if (rand < 0.35) {
        hour = 12 + Math.floor(Math.random() * 3); // 12, 13, 14
      } else if (rand < 0.85) {
        hour = 18 + Math.floor(Math.random() * 4); // 18, 19, 20, 21
      } else {
        hour = 15 + Math.floor(Math.random() * 3); // 15, 16, 17
      }

      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - day);
      orderDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
      const orderDateStr = orderDate.toISOString();

      const tableId = allTableIds[Math.floor(Math.random() * allTableIds.length)];

      let status = 'completed';
      if (day === 0) {
        const statuses = ['pending', 'preparing', 'ready', 'completed'];
        status = statuses[Math.floor(Math.random() * statuses.length)];
      }

      // Pick 2-5 menu items for this order
      const itemCount = Math.floor(Math.random() * 3) + 2;
      const selectedDishes = [];
      let totalAmount = 0;

      for (let i = 0; i < itemCount; i++) {
        const dish = allMenuItems[Math.floor(Math.random() * allMenuItems.length)];
        const qty = Math.random() < 0.8 ? 1 : 2;
        const subtotal = dish.price * qty;
        totalAmount += subtotal;
        selectedDishes.push({ id: dish.id, price: dish.price, qty, subtotal });
      }

      const orderRes = insertOrder.run(tableId, status, totalAmount, '', orderDateStr, orderDateStr);
      const orderId = orderRes.lastInsertRowid;

      for (const item of selectedDishes) {
        insertOrderItem.run(orderId, item.id, item.qty, item.price, item.subtotal);
      }

      totalOrdersCount++;
    }
  }

  console.log(`[SEED] Created ${totalOrdersCount} orders across 14 days.`);

  console.log('[SEED] Inserting Food Waste Logs...');
  const insertWaste = db.prepare(`
    INSERT INTO food_waste_logs (inventory_item_id, quantity_wasted, reason, estimated_cost, logged_at, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const wasteData = [
    [inventoryIdMap['Baby Spinach'], 1.2, 'expired', 1.2 * 4.50, new Date(now.getTime() - 2 * 86400000).toISOString(), 'Wilting in lower crisper'],
    [inventoryIdMap['Heavy Cream 35%'], 1.5, 'expired', 1.5 * 4.20, new Date(now.getTime() - 3 * 86400000).toISOString(), 'Past sell-by date container'],
    [inventoryIdMap['Chicken Breast'], 0.8, 'overcooked', 0.8 * 6.50, new Date(now.getTime() - 4 * 86400000).toISOString(), 'Line cook prep defect on grill'],
    [inventoryIdMap['Roma Tomatoes'], 2.0, 'quality', 2.0 * 2.20, new Date(now.getTime() - 5 * 86400000).toISOString(), 'Bruised batch from shipment'],
    [inventoryIdMap['Avocado'], 0.6, 'expired', 0.6 * 6.00, new Date(now.getTime() - 6 * 86400000).toISOString(), 'Overripe beyond service standard'],
    [inventoryIdMap['Atlantic Salmon Fillet'], 0.4, 'spilled', 0.4 * 14.00, new Date(now.getTime() - 7 * 86400000).toISOString(), 'Dropped during station prep'],
  ];

  for (const w of wasteData) {
    if (w[0]) insertWaste.run(...w);
  }

  // Initial menu availability sync
  syncMenuAvailability();
  console.log('[SEED] Database seeding complete! All models populated successfully.');
}

seedDatabase();
