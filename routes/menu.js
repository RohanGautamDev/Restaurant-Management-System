/**
 * DineMind AI — routes/menu.js
 * Menu catalog CRUD & dynamic availability synchronization
 */

'use strict';

const express = require('express');
const router = express.Router();
const { db, syncMenuAvailability } = require('../db/database');

// GET /api/menu/
router.get('/', (req, res) => {
  try {
    const { category, available } = req.query;
    let query = 'SELECT * FROM menu_items WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (available === 'true') {
      query += ' AND is_available = 1';
    }

    query += ' ORDER BY category ASC, price ASC';

    const items = db.prepare(query).all(...params);

    const categoryLabels = {
      starter: 'Starter',
      main: 'Main Course',
      dessert: 'Dessert',
      beverage: 'Beverage',
      side: 'Side Dish',
      special: 'Chef Special',
    };

    const formatted = items.map(item => ({
      ...item,
      is_available: Boolean(item.is_available),
      is_vegetarian: Boolean(item.is_vegetarian),
      category_display: categoryLabels[item.category] || item.category,
    }));

    res.json({ results: formatted, count: formatted.length });
  } catch (err) {
    console.error('Menu List Error:', err);
    res.status(500).json({ error: 'Failed to retrieve menu catalog.' });
  }
});

// POST /api/menu/
router.post('/', (req, res) => {
  try {
    const {
      name,
      category = 'main',
      price,
      description = '',
      image_url = '',
      is_vegetarian = false,
      prep_time_minutes = 15,
      spice_level = 0,
      is_available = true,
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Dish name and price are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO menu_items (name, category, price, description, image_url, is_vegetarian, prep_time_minutes, spice_level, is_available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      category,
      parseFloat(price),
      description,
      image_url,
      is_vegetarian ? 1 : 0,
      parseInt(prep_time_minutes) || 15,
      parseInt(spice_level) || 0,
      is_available ? 1 : 0
    );

    const newItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Create Menu Error:', err);
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A menu dish with this name already exists.' });
    }
    res.status(500).json({ error: 'Failed to create menu item.' });
  }
});

// GET /api/menu/:id/
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found.' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get menu item.' });
  }
});

// PATCH /api/menu/:id/
router.patch('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found.' });

    const updates = [];
    const params = [];

    const allowed = ['name', 'category', 'price', 'description', 'image_url', 'is_vegetarian', 'prep_time_minutes', 'spice_level', 'is_available'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        let val = req.body[key];
        if (key === 'is_vegetarian' || key === 'is_available') val = val ? 1 : 0;
        params.push(val);
      }
    }

    if (updates.length === 0) return res.json(item);

    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updatedItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    res.json(updatedItem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update menu item.' });
  }
});

// DELETE /api/menu/:id/
router.delete('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found.' });

    db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete menu item.' });
  }
});

// POST /api/menu/sync-all/
router.post('/sync-all/', (req, res) => {
  try {
    syncMenuAvailability();
    res.json({ success: true, message: 'All menu items synced with current inventory levels.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync menu availability.' });
  }
});

module.exports = router;
