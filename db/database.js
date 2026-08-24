/**
 * DineMind AI — db/database.js
 * SQLite Database Connection & Schema Definition (all 8 models)
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dinemind.db');
const db = new Database(dbPath);

// Enable WAL mode & foreign keys for performance and data integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    -- 1. Inventory Items
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'other',
      quantity REAL NOT NULL DEFAULT 0.0,
      unit TEXT NOT NULL DEFAULT 'kg',
      min_stock_threshold REAL NOT NULL DEFAULT 5.0,
      cost_per_unit REAL NOT NULL DEFAULT 0.0,
      supplier_name TEXT DEFAULT '',
      supplier_contact TEXT DEFAULT '',
      last_restocked TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 2. Menu Items
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'main',
      price REAL NOT NULL,
      description TEXT DEFAULT '',
      is_available INTEGER NOT NULL DEFAULT 1,
      image_url TEXT DEFAULT '',
      is_vegetarian INTEGER NOT NULL DEFAULT 0,
      prep_time_minutes INTEGER NOT NULL DEFAULT 15,
      spice_level INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 3. Menu Item Ingredients (Recipe Mapping)
    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      quantity_required REAL NOT NULL,
      UNIQUE(menu_item_id, inventory_item_id)
    );

    -- 4. Restaurant Tables
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number INTEGER NOT NULL UNIQUE,
      capacity INTEGER NOT NULL DEFAULT 4,
      location TEXT NOT NULL DEFAULT 'indoor',
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 5. Reservations
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      customer_email TEXT DEFAULT '',
      table_id INTEGER REFERENCES restaurant_tables(id) ON DELETE SET NULL,
      num_guests INTEGER NOT NULL,
      reservation_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 90,
      status TEXT NOT NULL DEFAULT 'confirmed',
      special_requests TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 6. Orders
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'pending',
      total_amount REAL NOT NULL DEFAULT 0.0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 7. Order Items
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    -- 8. Food Waste Logs
    CREATE TABLE IF NOT EXISTS food_waste_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      quantity_wasted REAL NOT NULL,
      reason TEXT NOT NULL DEFAULT 'expired',
      estimated_cost REAL NOT NULL DEFAULT 0.0,
      logged_at TEXT DEFAULT (datetime('now')),
      notes TEXT DEFAULT ''
    );
  `);
}

// Helper to sync menu item availability across the entire catalog
function syncMenuAvailability(menuItemId = null) {
  let itemsToSync = [];
  if (menuItemId) {
    itemsToSync = [db.prepare('SELECT * FROM menu_items WHERE id = ?').get(menuItemId)];
  } else {
    itemsToSync = db.prepare('SELECT * FROM menu_items').all();
  }

  const checkStmt = db.prepare(`
    SELECT ii.quantity, mii.quantity_required
    FROM menu_item_ingredients mii
    JOIN inventory_items ii ON mii.inventory_item_id = ii.id
    WHERE mii.menu_item_id = ?
  `);

  const updateStmt = db.prepare('UPDATE menu_items SET is_available = ? WHERE id = ?');

  for (const item of itemsToSync) {
    if (!item) continue;
    const ingredients = checkStmt.all(item.id);
    let available = 1;
    for (const ing of ingredients) {
      if (ing.quantity < ing.quantity_required) {
        available = 0;
        break;
      }
    }
    updateStmt.run(available, item.id);
  }
}

initSchema();

module.exports = {
  db,
  syncMenuAvailability,
};
