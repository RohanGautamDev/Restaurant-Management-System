/**
 * DineMind AI — routes/inventory.js
 * Stock management, thresholds & replenishment
 */

'use strict';

const express = require('express');
const router = express.Router();
const { db, syncMenuAvailability } = require('../db/database');

// GET /api/inventory/
router.get('/', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM inventory_items ORDER BY name ASC').all();

    const formatted = items.map(item => {
      let stock_status = 'in_stock';
      if (item.quantity <= 0) stock_status = 'out_of_stock';
      else if (item.quantity <= item.min_stock_threshold) stock_status = 'low_stock';

      return {
        ...item,
        stock_status,
      };
    });

    res.json({ results: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve inventory.' });
  }
});

// GET /api/inventory/low-stock/
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

// GET /api/inventory/:id/
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Inventory item not found.' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve inventory item.' });
  }
});

// PATCH /api/inventory/:id/
router.patch('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

    const { quantity } = req.body;
    if (quantity !== undefined) {
      db.prepare(`
        UPDATE inventory_items 
        SET quantity = ?, last_restocked = datetime('now'), updated_at = datetime('now') 
        WHERE id = ?
      `).run(parseFloat(quantity), req.params.id);

      // Re-sync all menu availability automatically
      syncMenuAvailability();
    }

    const updated = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update stock.' });
  }
});

module.exports = router;
