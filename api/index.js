/**
 * DineMind AI — api/index.js
 * Vercel Serverless Function Entrypoint
 * Delegates execution directly to server.js to guarantee 100% route parity
 * between local environment and production deployment.
 */

'use strict';

const app = require('../server');

module.exports = app;
