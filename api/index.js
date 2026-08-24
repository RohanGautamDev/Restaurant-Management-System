/**
 * DineMind AI — api/index.js
 * Vercel Serverless Function Entrypoint
 */

'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use('/static', express.static(path.join(__dirname, '..', 'static')));

// Mount API Routes
app.use('/api/dashboard', require('../routes/dashboard'));
app.use('/api/menu', require('../routes/menu'));
app.use('/api/orders', require('../routes/orders'));
app.use('/api/tables', require('../routes/tables'));
app.use('/api/reservations', require('../routes/reservations'));
app.use('/api/inventory', require('../routes/inventory'));
app.use('/api/waste', require('../routes/waste'));
app.use('/api/reports', require('../routes/reports'));

// Serve Main Frontend SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'templates', 'index.html'));
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/static/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'templates', 'index.html'));
});

module.exports = app;
