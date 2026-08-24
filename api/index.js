/**
 * DineMind AI — api/index.js
 * Vercel Modern Serverless Entrypoint
 */

'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets using process.cwd() for serverless directory resolution
app.use('/static', express.static(path.join(process.cwd(), 'static')));

// Mount API Routes
app.use('/api/dashboard', require('../routes/dashboard'));
app.use('/api/menu', require('../routes/menu'));
app.use('/api/orders', require('../routes/orders'));
app.use('/api/tables', require('../routes/tables'));
app.use('/api/reservations', require('../routes/reservations'));
app.use('/api/inventory', require('../routes/inventory'));
app.use('/api/waste', require('../routes/waste'));
app.use('/api/reports', require('../routes/reports'));

// Serve Main Single Page Application HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'templates', 'index.html'));
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/static/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(process.cwd(), 'templates', 'index.html'));
});

module.exports = app;
