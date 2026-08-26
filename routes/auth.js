/**
 * DineMind AI — routes/auth.js
 * Authentication REST API (Sign Up, Sign In, Profile, Logout)
 * Powered by SQLite & Node.js Crypto PBKDF2
 */

'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/database');

/**
 * Hash password with PBKDF2 and a random salt
 */
function hashPassword(password, existingSalt = null) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Generate lightweight secure token
 */
function generateToken(user) {
  const payload = JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    issuedAt: Date.now()
  });
  return Buffer.from(payload).toString('base64');
}

/**
 * Decode token payload
 */
function decodeToken(token) {
  try {
    const json = Buffer.from(token, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/auth/signup
 * Register a new user account
 */
router.post('/signup', (req, res) => {
  try {
    const { username, email, password, full_name, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = ['admin', 'manager', 'staff'].includes(role) ? role : 'manager';
    const cleanFullName = (full_name || cleanUsername).trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check existing username or email
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already registered.' });
    }

    const { salt, hash } = hashPassword(password);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, salt, full_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(cleanUsername, cleanEmail, hash, salt, cleanFullName, cleanRole);

    const newUser = db.prepare('SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('Error during signup:', err);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

/**
 * POST /api/auth/login
 * Sign in to an existing account
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const cleanInput = username.trim().toLowerCase();

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(cleanInput, cleanInput);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const { hash } = hashPassword(password, user.salt);
    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const userProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      created_at: user.created_at
    };

    const token = generateToken(userProfile);

    return res.json({
      success: true,
      message: `Welcome back, ${user.full_name || user.username}!`,
      user: userProfile,
      token
    });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Failed to authenticate user.' });
  }
});

/**
 * GET /api/auth/me
 * Fetch authenticated user profile from token
 */
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized. No token provided.' });
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    const user = db.prepare('SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    return res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Failed to verify session.' });
  }
});

/**
 * POST /api/auth/logout
 * Sign out session
 */
router.post('/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

/**
 * GET /api/auth/restaurant
 * Fetch the restaurant profile for the authenticated user
 */
router.get('/restaurant', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const token = authHeader.substring(7);
    const decoded = decodeToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    const profile = db.prepare('SELECT * FROM restaurant_profiles WHERE user_id = ?').get(decoded.id);
    return res.json({ success: true, profile: profile || null });
  } catch (err) {
    console.error('Error fetching restaurant profile:', err);
    return res.status(500).json({ error: 'Failed to fetch restaurant profile.' });
  }
});

/**
 * POST /api/auth/restaurant
 * Create or update the restaurant profile for the authenticated user
 */
router.post('/restaurant', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const token = authHeader.substring(7);
    const decoded = decodeToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    const { restaurant_name, address, phone, logo_emoji, currency, tagline } = req.body;
    if (!restaurant_name || !restaurant_name.trim()) {
      return res.status(400).json({ error: 'Restaurant name is required.' });
    }

    const existing = db.prepare('SELECT id FROM restaurant_profiles WHERE user_id = ?').get(decoded.id);

    if (existing) {
      db.prepare(`
        UPDATE restaurant_profiles
        SET restaurant_name = ?, address = ?, phone = ?, logo_emoji = ?, currency = ?, tagline = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(
        restaurant_name.trim(),
        (address || '').trim(),
        (phone || '').trim(),
        (logo_emoji || '🍽️').trim(),
        (currency || 'USD').trim(),
        (tagline || '').trim(),
        decoded.id
      );
    } else {
      db.prepare(`
        INSERT INTO restaurant_profiles (user_id, restaurant_name, address, phone, logo_emoji, currency, tagline)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        decoded.id,
        restaurant_name.trim(),
        (address || '').trim(),
        (phone || '').trim(),
        (logo_emoji || '🍽️').trim(),
        (currency || 'USD').trim(),
        (tagline || '').trim()
      );
    }

    const profile = db.prepare('SELECT * FROM restaurant_profiles WHERE user_id = ?').get(decoded.id);
    return res.json({ success: true, message: 'Restaurant profile saved!', profile });
  } catch (err) {
    console.error('Error saving restaurant profile:', err);
    return res.status(500).json({ error: 'Failed to save restaurant profile.' });
  }
});

module.exports = router;

