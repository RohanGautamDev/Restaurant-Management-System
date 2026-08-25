/**
 * DineMind AI — routes/orders.js
 * Atomic Order Processing, Ingredient Deduction & Table Status Management
 */

'use strict';

const express = require('express');
const router = express.Router();
const { db, syncMenuAvailability } = require('../db/database');

// GET /api/orders/
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT o.*, t.table_number, t.location as table_location
      FROM orders o
      JOIN restaurant_tables t ON o.table_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND o.status = ?';
      params.push(status);
    }

    query += ' ORDER BY o.id DESC LIMIT 100';

    const orders = db.prepare(query).all(...params);

    const getItemsStmt = db.prepare(`
      SELECT oi.*, mi.name as menu_item_name, mi.category as menu_item_category
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
    `);

    const statusLabels = {
      pending: 'Pending',
      preparing: 'Preparing',
      ready: 'Ready',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };

    const formatted = orders.map(o => {
      const items = getItemsStmt.all(o.id);
      return {
        ...o,
        status_display: statusLabels[o.status] || o.status,
        items,
      };
    });

    res.json({ results: formatted, count: formatted.length });
  } catch (err) {
    console.error('Orders List Error:', err);
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

// POST /api/orders/ — Transaction-Atomic Order Placement
router.post('/', (req, res) => {
  try {
    const { table_id, items, notes = '' } = req.body;

    if (!table_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'table_id and at least one order item are required.' });
    }

    // Execute atomic transaction
    const processOrderTx = db.transaction(() => {
      // 1. Check table existence and availability
      const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(table_id);
      if (!table) {
        throw new Error(`Table with ID ${table_id} does not exist.`);
      }

      // 2. Fetch dishes & calculate required ingredients
      const requiredIngredients = new Map();
      let totalAmount = 0;
      const orderItemsToCreate = [];

      const getDishStmt = db.prepare('SELECT * FROM menu_items WHERE id = ?');
      const getIngredientsStmt = db.prepare(`
        SELECT mii.quantity_required, ii.id as inventory_item_id, ii.name as inventory_name, ii.quantity as current_stock, ii.unit
        FROM menu_item_ingredients mii
        JOIN inventory_items ii ON mii.inventory_item_id = ii.id
        WHERE mii.menu_item_id = ?
      `);

      for (const reqItem of items) {
        const dish = getDishStmt.get(reqItem.menu_item_id);
        if (!dish) {
          throw new Error(`Menu item ID ${reqItem.menu_item_id} not found.`);
        }
        if (!dish.is_available) {
          throw new Error(`Dish "${dish.name}" is currently marked out of stock.`);
        }

        const qty = parseInt(reqItem.quantity) || 1;
        const subtotal = dish.price * qty;
        totalAmount += subtotal;

        orderItemsToCreate.push({
          menu_item_id: dish.id,
          name: dish.name,
          quantity: qty,
          unit_price: dish.price,
          subtotal: parseFloat(subtotal.toFixed(2)),
        });

        // Track ingredients needed
        const recipeIngredients = getIngredientsStmt.all(dish.id);
        for (const recipe of recipeIngredients) {
          const needed = recipe.quantity_required * qty;
          const current = requiredIngredients.get(recipe.inventory_item_id) || {
            name: recipe.inventory_name,
            totalNeeded: 0,
            currentStock: recipe.current_stock,
            unit: recipe.unit,
          };
          current.totalNeeded += needed;
          requiredIngredients.set(recipe.inventory_item_id, current);
        }
      }

      // 3. Validate stock sufficiency
      for (const [invId, ing] of requiredIngredients.entries()) {
        if (ing.currentStock < ing.totalNeeded) {
          throw new Error(`Insufficient stock for ingredient: ${ing.name}. Required: ${ing.totalNeeded.toFixed(2)}${ing.unit}, Available: ${ing.currentStock.toFixed(2)}${ing.unit}`);
        }
      }

      // 4. Create Order record
      const insertOrderStmt = db.prepare(`
        INSERT INTO orders (table_id, status, total_amount, notes, created_at, updated_at)
        VALUES (?, 'pending', ?, ?, datetime('now'), datetime('now'))
      `);
      const orderResult = insertOrderStmt.run(table_id, parseFloat(totalAmount.toFixed(2)), notes);
      const orderId = orderResult.lastInsertRowid;

      // 5. Create OrderItem records
      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const item of orderItemsToCreate) {
        insertItemStmt.run(orderId, item.menu_item_id, item.quantity, item.unit_price, item.subtotal);
      }

      // 6. Deduct inventory quantities
      const deductStockStmt = db.prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?');
      for (const [invId, ing] of requiredIngredients.entries()) {
        deductStockStmt.run(ing.totalNeeded, invId);
      }

      // 7. Update table to occupied
      db.prepare("UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?").run(table_id);

      return {
        id: orderId,
        table_id,
        table_number: table.table_number,
        status: 'pending',
        total_amount: parseFloat(totalAmount.toFixed(2)),
        notes,
        items: orderItemsToCreate,
      };
    });

    const createdOrder = processOrderTx();

    // 8. Trigger automatic menu sync
    syncMenuAvailability();

    res.status(201).json(createdOrder);
  } catch (err) {
    console.error('Order Placement Error:', err);
    res.status(400).json({ error: err.message || 'Failed to place order.' });
  }
});

// PATCH /api/orders/:id/ — Status update
router.patch('/:id', (req, res) => {
  try {
    const { status } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (status) {
      db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);

      // If order is completed or cancelled, check if there are other active orders at this table
      if (status === 'completed' || status === 'cancelled') {
        const remainingActive = db.prepare(`
          SELECT COUNT(*) as count FROM orders 
          WHERE table_id = ? AND status IN ('pending', 'preparing', 'ready') AND id != ?
        `).get(order.table_id, order.id);

        if (remainingActive.count === 0) {
          db.prepare("UPDATE restaurant_tables SET status = 'available' WHERE id = ?").run(order.table_id);
        }
      }
    }

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

module.exports = router;
