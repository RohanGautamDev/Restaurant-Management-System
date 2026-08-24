/**
 * DineMind AI — routes/reservations.js
 * Reservation scheduling & conflict prevention
 */

'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET /api/reservations/
router.get('/', (req, res) => {
  try {
    const reservations = db.prepare(`
      SELECT r.*, t.table_number, t.location as table_location
      FROM reservations r
      LEFT JOIN restaurant_tables t ON r.table_id = t.id
      ORDER BY r.reservation_time ASC
      LIMIT 100
    `).all();

    const statusLabels = {
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };

    const formatted = reservations.map(r => ({
      ...r,
      status_display: statusLabels[r.status] || r.status,
    }));

    res.json({ results: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve reservations.' });
  }
});

// POST /api/reservations/
router.post('/', (req, res) => {
  try {
    const {
      customer_name,
      customer_phone = '',
      customer_email = '',
      table_id,
      table, // fallback
      num_guests,
      reservation_time,
      duration_minutes = 90,
      special_requests = '',
      status = 'confirmed',
    } = req.body;

    const targetTableId = table_id || table || null;

    if (!customer_name || !num_guests || !reservation_time) {
      return res.status(400).json({ error: 'customer_name, num_guests, and reservation_time are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO reservations (customer_name, customer_phone, customer_email, table_id, num_guests, reservation_time, duration_minutes, special_requests, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      customer_name,
      customer_phone,
      customer_email,
      targetTableId ? parseInt(targetTableId) : null,
      parseInt(num_guests),
      reservation_time,
      parseInt(duration_minutes) || 90,
      special_requests,
      status
    );

    // If table was specified, mark table as reserved
    if (targetTableId) {
      db.prepare("UPDATE restaurant_tables SET status = 'reserved' WHERE id = ?").run(targetTableId);
    }

    const newRes = db.prepare(`
      SELECT r.*, t.table_number
      FROM reservations r
      LEFT JOIN restaurant_tables t ON r.table_id = t.id
      WHERE r.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newRes);
  } catch (err) {
    console.error('Create Reservation Error:', err);
    res.status(500).json({ error: 'Failed to create reservation.' });
  }
});

// PATCH /api/reservations/:id/
router.patch('/:id', (req, res) => {
  try {
    const resId = req.params.id;
    const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(resId);
    if (!r) return res.status(404).json({ error: 'Reservation not found.' });

    const { status } = req.body;
    if (status) {
      db.prepare("UPDATE reservations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, resId);

      if (status === 'cancelled' || status === 'completed') {
        if (r.table_id) {
          db.prepare("UPDATE restaurant_tables SET status = 'available' WHERE id = ?").run(r.table_id);
        }
      }
    }

    const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(resId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reservation.' });
  }
});

module.exports = router;
