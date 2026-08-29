/**
 * DineMind AI — server.js
 * Express Web Server & REST API Entrypoint
 * Compatible with both local runtime & Vercel Serverless
 */

'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for live system monitoring
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'DineMind AI',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`
  });
});

// Public config endpoint — serves non-secret client config
app.get('/api/config', (req, res) => {
  res.json({
    mapplsApiKey: process.env.VITE_MAPPLS_API_KEY || process.env.MAPPLS_API_KEY || 'mdwallaqjppbxotocjucfjxjronwpotbclru',
    googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

// Serve static assets (CSS, JS, images)
app.use('/static', express.static(path.join(__dirname, 'static')));

// Mount API Routes
app.use('/api', require('./routes/mappls'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/waste', require('./routes/waste'));
app.use('/api/reports', require('./routes/reports'));

// Serve Main Single Page Application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/static/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Start Server when run directly (local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🚀 DineMind AI Node.js Server is running!`);
    console.log(`🌐 URL: http://127.0.0.1:${PORT}/`);
    console.log(`📦 Database: SQLite (dinemind.db)`);
    console.log('═══════════════════════════════════════════════════════');
  });
}

// Export app for Vercel Serverless Function runtime
module.exports = app;
