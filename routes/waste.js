/**
 * DineMind AI — routes/waste.js
 * Food waste logging, automatic inventory decrement & sustainability metrics
 */

'use strict';

const express = require('express');
const router = express.Router();
const { db, syncMenuAvailability } = require('../db/database');

// GET /api/waste/
router.get('/', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT fwl.*, ii.name as inventory_item_name, ii.unit as inventory_item_unit
      FROM food_waste_logs fwl
      JOIN inventory_items ii ON fwl.inventory_item_id = ii.id
      ORDER BY fwl.logged_at DESC
      LIMIT 100
    `).all();

    const reasonLabels = {
      expired: 'Expired / Spoilage',
      overcooked: 'Overcooked / Prep Defect',
      spilled: 'Spilled / Damaged',
      quality: 'Quality Rejected',
      other: 'Other Incident',
    };

    const formatted = logs.map(l => ({
      ...l,
      reason_display: reasonLabels[l.reason] || l.reason,
    }));

    res.json({ results: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve food waste logs.' });
  }
});

// POST /api/waste/ — Atomic Waste Logging & Inventory Deduction
router.post('/', (req, res) => {
  try {
    const { inventory_item, inventory_item_id, quantity_wasted, reason = 'expired', notes = '' } = req.body;
    const targetItemId = inventory_item_id || inventory_item;
    const wastedQty = parseFloat(quantity_wasted);

    if (!targetItemId || !wastedQty || wastedQty <= 0) {
      return res.status(400).json({ error: 'Valid inventory_item and quantity_wasted are required.' });
    }

    const logWasteTx = db.transaction(() => {
      const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(targetItemId);
      if (!item) throw new Error('Inventory item not found.');

      const cost = parseFloat((wastedQty * item.cost_per_unit).toFixed(2));

      // Insert waste log
      const insertStmt = db.prepare(`
        INSERT INTO food_waste_logs (inventory_item_id, quantity_wasted, reason, estimated_cost, logged_at, notes)
        VALUES (?, ?, ?, ?, datetime('now'), ?)
      `);
      const result = insertStmt.run(targetItemId, wastedQty, reason, cost, notes);

      // Decrement inventory (do not let quantity go negative)
      const newQty = Math.max(0.0, item.quantity - wastedQty);
      db.prepare("UPDATE inventory_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(newQty, targetItemId);

      return {
        id: result.lastInsertRowid,
        inventory_item_id: targetItemId,
        quantity_wasted: wastedQty,
        reason,
        estimated_cost: cost,
        notes,
      };
    });

    const createdLog = logWasteTx();

    syncMenuAvailability();

    res.status(201).json(createdLog);
  } catch (err) {
    console.error('Log Waste Error:', err);
    res.status(400).json({ error: err.message || 'Failed to log food waste.' });
  }
});

// GET /api/waste/summary/
router.get('/summary/', (req, res) => {
  try {
    const totalStats = db.prepare(`
      SELECT 
        COUNT(*) as total_entries,
        COALESCE(SUM(estimated_cost), 0.0) as total_waste_cost
      FROM food_waste_logs
    `).get();

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weeklyStats = db.prepare(`
      SELECT COALESCE(SUM(estimated_cost), 0.0) as weekly_waste_cost
      FROM food_waste_logs
      WHERE logged_at >= ?
    `).get(sevenDaysAgo);

    const topWasted = db.prepare(`
      SELECT ii.name as item_name, SUM(fwl.estimated_cost) as waste_cost, SUM(fwl.quantity_wasted) as total_qty
      FROM food_waste_logs fwl
      JOIN inventory_items ii ON fwl.inventory_item_id = ii.id
      GROUP BY ii.id
      ORDER BY waste_cost DESC
      LIMIT 5
    `).all();

    res.json({
      total_entries: totalStats.total_entries,
      total_waste_cost: parseFloat(totalStats.total_waste_cost.toFixed(2)),
      weekly_waste_cost: parseFloat(weeklyStats.weekly_waste_cost.toFixed(2)),
      top_wasted_items: topWasted,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute waste summary.' });
  }
});

module.exports = router;
