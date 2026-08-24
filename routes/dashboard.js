/**
 * DineMind AI — routes/dashboard.js
 * Dashboard KPIs, live counts & smart operational alerts
 */

'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

router.get('/stats/', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Today's revenue & orders
    const todayStats = db.prepare(`
      SELECT 
        COUNT(*) as today_orders,
        COALESCE(SUM(total_amount), 0.0) as today_revenue
      FROM orders
      WHERE date(created_at) = ? AND status != 'cancelled'
    `).get(today);

    // Total all-time revenue & orders
    const totalStats = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0.0) as total_revenue
      FROM orders
      WHERE status != 'cancelled'
    `).get();

    // Table counts
    const tableCounts = db.prepare(`
      SELECT 
        COUNT(*) as total_tables,
        COALESCE(SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END), 0) as available_tables,
        COALESCE(SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END), 0) as occupied_tables,
        COALESCE(SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END), 0) as reserved_tables
      FROM restaurant_tables
    `).get();

    // Low stock items
    const lowStockItems = db.prepare(`
      SELECT id, name, quantity, min_stock_threshold as min_threshold, unit
      FROM inventory_items
      WHERE quantity <= min_stock_threshold
      ORDER BY quantity ASC
    `).all();

    // Active orders (pending, preparing, ready)
    const activeOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'preparing', 'ready')
    `).get();

    // Popular dish today
    const popularDish = db.prepare(`
      SELECT mi.name, SUM(oi.quantity) as total_qty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE date(o.created_at) = ? AND o.status != 'cancelled'
      GROUP BY mi.id
      ORDER BY total_qty DESC
      LIMIT 1
    `).get(today);

    res.json({
      today_revenue: parseFloat(todayStats.today_revenue.toFixed(2)),
      today_orders: todayStats.today_orders,
      active_orders: activeOrders.count,
      total_revenue_all_time: parseFloat(totalStats.total_revenue.toFixed(2)),
      total_orders_all_time: totalStats.total_orders,
      total_tables: tableCounts.total_tables,
      available_tables: tableCounts.available_tables,
      occupied_tables: tableCounts.occupied_tables,
      reserved_tables: tableCounts.reserved_tables,
      low_stock_count: lowStockItems.length,
      low_stock_items: lowStockItems,
      popular_dish: popularDish ? popularDish.name : 'Chef Special',
    });
  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    res.status(500).json({ error: 'Failed to compute dashboard statistics.' });
  }
});

module.exports = router;
