/**
 * DineMind AI — routes/reports.js
 * Analytics, Historical Sales Trends, Peak Hours & Popular Dish Rankings
 */

'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET /api/reports/daily-sales/
router.get('/daily-sales/', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const dailyBreakdown = [];

    const getDaySalesStmt = db.prepare(`
      SELECT 
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0.0) as revenue
      FROM orders
      WHERE date(created_at) = ? AND status != 'cancelled'
    `);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const stats = getDaySalesStmt.get(dateStr);

      dailyBreakdown.push({
        date: dateStr,
        orders: stats.orders,
        revenue: parseFloat(stats.revenue.toFixed(2)),
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayStats = getDaySalesStmt.get(todayStr);

    res.json({
      daily_breakdown: dailyBreakdown,
      today: {
        date: todayStr,
        orders: todayStats.orders,
        revenue: parseFloat(todayStats.revenue.toFixed(2)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate daily sales report.' });
  }
});

// GET /api/reports/peak-hours/
router.get('/peak-hours/', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

    const hourlyOrders = db.prepare(`
      SELECT 
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COUNT(*) as order_count
      FROM orders
      WHERE created_at >= ? AND status != 'cancelled'
      GROUP BY hour
      ORDER BY hour ASC
    `).all(sinceDate);

    // Fill all 24 hours (or 11h to 23h operating range)
    const hourlyMap = new Map();
    for (let h = 10; h <= 23; h++) hourlyMap.set(h, 0);
    for (const row of hourlyOrders) {
      hourlyMap.set(row.hour, row.order_count);
    }

    const breakdown = Array.from(hourlyMap.entries()).map(([hour, count]) => ({
      hour,
      order_count: count,
    }));

    // Find peak hour
    let peakHour = 19;
    let maxOrders = 0;
    for (const b of breakdown) {
      if (b.order_count > maxOrders) {
        maxOrders = b.order_count;
        peakHour = b.hour;
      }
    }

    const formatHour = (h) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const standard = h % 12 || 12;
      return `${standard}:00 ${period}`;
    };

    res.json({
      hourly_breakdown: breakdown,
      peak_hour: peakHour,
      peak_hour_formatted: `${formatHour(peakHour)} - ${formatHour(peakHour + 1)}`,
      peak_order_count: maxOrders,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute peak hour distribution.' });
  }
});

// GET /api/reports/popular-items/
router.get('/popular-items/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const popular = db.prepare(`
      SELECT 
        mi.id,
        mi.name,
        mi.category,
        mi.price,
        SUM(oi.quantity) as total_ordered,
        SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.status != 'cancelled'
      GROUP BY mi.id
      ORDER BY total_ordered DESC
      LIMIT ?
    `).all(limit);

    res.json({
      top_items: popular.map(p => ({
        ...p,
        total_revenue: parseFloat(p.total_revenue.toFixed(2)),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve popular dishes ranking.' });
  }
});

// GET /api/reports/low-stock/
router.get('/low-stock/', (req, res) => {
  try {
    const lowItems = db.prepare(`
      SELECT *, min_stock_threshold as min_threshold, (min_stock_threshold - quantity) as deficit
      FROM inventory_items
      WHERE quantity <= min_stock_threshold
      ORDER BY quantity ASC
    `).all();

    res.json({
      low_stock_count: lowItems.length,
      low_stock_items: lowItems.map(i => ({
        ...i,
        status: i.quantity <= 0 ? 'out_of_stock' : 'low_stock',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get low stock report.' });
  }
});

module.exports = router;
