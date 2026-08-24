/**
 * DineMind AI — routes/tables.js
 * Restaurant Floorplan & Smart Table Recommendation Engine
 */

'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET /api/tables/
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM restaurant_tables WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY table_number ASC';

    const tables = db.prepare(query).all(...params);

    const locationLabels = {
      indoor: 'Indoor Dining',
      outdoor: 'Outdoor Patio',
      private: 'Private Dining',
      bar: 'Bar Lounge',
      window: 'Window View',
    };

    const statusLabels = {
      available: 'Available',
      occupied: 'Occupied',
      reserved: 'Reserved',
    };

    const formatted = tables.map(t => ({
      ...t,
      location_display: locationLabels[t.location] || t.location,
      status_display: statusLabels[t.status] || t.status,
    }));

    res.json({ results: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve tables.' });
  }
});

// GET /api/tables/recommend/?guests=N — Smart Table Recommendation Engine
router.get('/recommend/', (req, res) => {
  try {
    const guests = parseInt(req.query.guests) || 2;

    // Find available tables that fit >= guests, sorted by capacity ascending (tightest fit first)
    const tables = db.prepare(`
      SELECT * FROM restaurant_tables
      WHERE status = 'available' AND capacity >= ?
      ORDER BY capacity ASC, table_number ASC
    `).all(guests);

    if (tables.length === 0) {
      return res.json({
        recommended: null,
        message: `No currently available tables with capacity for ${guests} guests.`,
        alternatives: [],
      });
    }

    const recommended = tables[0];
    const alternatives = tables.slice(1, 4);

    const locationLabels = {
      indoor: 'Indoor Dining',
      outdoor: 'Outdoor Patio',
      private: 'Private Dining',
      bar: 'Bar Lounge',
      window: 'Window View',
    };

    res.json({
      recommended: {
        ...recommended,
        location_display: locationLabels[recommended.location] || recommended.location,
      },
      message: `Table ${recommended.table_number} (${recommended.capacity} seats, ${locationLabels[recommended.location] || recommended.location}) offers the optimal seating fit.`,
      alternatives: alternatives.map(a => ({
        ...a,
        location_display: locationLabels[a.location] || a.location,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to run table recommendation algorithm.' });
  }
});

// GET /api/tables/availability-summary/
router.get('/availability-summary/', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END), 0) as available,
        COALESCE(SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END), 0) as occupied,
        COALESCE(SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END), 0) as reserved
      FROM restaurant_tables
    `).get();

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get table availability summary.' });
  }
});

module.exports = router;
