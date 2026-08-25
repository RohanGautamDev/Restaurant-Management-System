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

// POST /api/inventory/ — Add new custom ingredient with photo URL & details
router.post('/', (req, res) => {
  try {
    const {
      name,
      category = 'other',
      quantity = 0.0,
      unit = 'kg',
      min_stock_threshold = 5.0,
      cost_per_unit = 0.0,
      supplier_name = '',
      supplier_contact = '',
      image_url = '',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Ingredient name is required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO inventory_items (name, category, quantity, unit, min_stock_threshold, cost_per_unit, supplier_name, supplier_contact, image_url, last_restocked, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      name.trim(),
      category,
      parseFloat(quantity) || 0.0,
      unit.trim() || 'kg',
      parseFloat(min_stock_threshold) || 5.0,
      parseFloat(cost_per_unit) || 0.0,
      supplier_name.trim(),
      supplier_contact.trim(),
      image_url.trim()
    );

    const newItem = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(result.lastInsertRowid);
    syncMenuAvailability();
    res.status(201).json(newItem);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: `An ingredient named "${req.body.name}" already exists.` });
    }
    console.error('Create Inventory Error:', err);
    res.status(500).json({ error: 'Failed to create inventory ingredient.' });
  }
});

// DELETE /api/inventory/:id/ — Delete ingredient
router.delete('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

    db.prepare('DELETE FROM inventory_items WHERE id = ?').run(req.params.id);
    syncMenuAvailability();
    res.json({ message: `Ingredient "${item.name}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete inventory ingredient.' });
  }
});

module.exports = router;
