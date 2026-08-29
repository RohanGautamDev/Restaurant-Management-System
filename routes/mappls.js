/**
 * DineMind AI — Mappls Backend Proxy Routes
 * Bypasses CORS and provides secure server-side Mappls REST API integration.
 */

'use strict';

const express = require('express');
const router = express.Router();

// GET /api/config — Serves client configuration
router.get('/config', (req, res) => {
  const key = process.env.MAPPLS_API_KEY || process.env.VITE_MAPPLS_API_KEY || 'mdwallaqjppbxotocjucfjxjronwpotbclru';
  res.json({
    mapplsKey: key,
    mapplsApiKey: key,
    googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

// GET /api/reverse-geocode?lat=<lat>&lng=<lng> — Server-side reverse geocoding proxy
router.get('/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitude and longitude query parameters are required' });
  }

  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng)) {
    return res.status(400).json({ error: 'Invalid latitude or longitude values' });
  }

  const key = process.env.MAPPLS_API_KEY || process.env.VITE_MAPPLS_API_KEY || 'mdwallaqjppbxotocjucfjxjronwpotbclru';

  // 1. Try Mappls Server-Side Reverse Geocoding API
  try {
    const mapplsRes = await fetch(`https://apis.mappls.com/advancedmaps/v1/${key}/rev_geocode?lat=${numLat}&lng=${numLng}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (mapplsRes.ok) {
      const data = await mapplsRes.json();
      if (data && data.results && data.results.length > 0) {
        const item = data.results[0];
        const addr = item.formatted_address || `${numLat.toFixed(5)}, ${numLng.toFixed(5)}`;
        return res.json({
          address: addr,
          city: item.city || item.district || item.subDistrict || '',
          state: item.state || '',
          country: item.country || 'India',
          postcode: item.pincode || '',
          lat: numLat,
          lng: numLng,
          source: 'mappls'
        });
      }
    }
  } catch (err) {
    console.warn('[DineMind Proxy] Mappls server-side rev_geocode failed:', err.message);
  }

  // 2. Server-side Nominatim Fallback (Prevents any CORS or client-side breakage)
  try {
    const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${numLat}&lon=${numLng}&format=json&addressdetails=1`, {
      headers: { 'User-Agent': 'DineMindAI-Server/1.0' }
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const addr = nomData.display_name || `${numLat.toFixed(5)}, ${numLng.toFixed(5)}`;
      const a = nomData.address || {};
      return res.json({
        address: addr,
        city: a.city || a.town || a.village || a.suburb || a.county || '',
        state: a.state || '',
        country: a.country || 'India',
        postcode: a.postcode || '',
        lat: numLat,
        lng: numLng,
        source: 'nominatim'
      });
    }
  } catch (err) {
    console.warn('[DineMind Proxy] Nominatim server-side rev_geocode failed:', err.message);
  }

  // 3. Fallback Coordinate String
  const coordStr = `${numLat.toFixed(5)}, ${numLng.toFixed(5)}`;
  return res.json({
    address: coordStr,
    city: '',
    state: '',
    country: 'India',
    postcode: '',
    lat: numLat,
    lng: numLng,
    source: 'coordinates'
  });
});

// GET /api/search?query=<query>&lat=<lat>&lng=<lng> — Server-side place search proxy
router.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query || query.trim().length < 2) {
    return res.json({ results: [] });
  }

  const key = process.env.MAPPLS_API_KEY || process.env.VITE_MAPPLS_API_KEY || 'mdwallaqjppbxotocjucfjxjronwpotbclru';

  // 1. Try Mappls Server-Side AutoSuggest API
  try {
    const mapplsRes = await fetch(`https://atlas.mappls.com/api/places/search/json?query=${encodeURIComponent(query.trim())}&access_token=${key}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (mapplsRes.ok) {
      const data = await mapplsRes.json();
      if (data && data.suggestedLocations && Array.isArray(data.suggestedLocations)) {
        const formatted = data.suggestedLocations.map(item => ({
          placeName: item.placeName || item.placeAddress || item.formatted_address || 'Location',
          placeAddress: item.placeAddress || item.address || '',
          latitude: parseFloat(item.latitude || item.lat),
          longitude: parseFloat(item.longitude || item.lng || item.lon)
        }));
        return res.json({ results: formatted, source: 'mappls' });
      }
    }
  } catch (err) {
    console.warn('[DineMind Proxy] Mappls server-side search failed:', err.message);
  }

  // 2. Server-Side Nominatim Search Fallback
  try {
    const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&format=json&addressdetails=1&limit=6&countrycodes=in`, {
      headers: { 'User-Agent': 'DineMindAI-Server/1.0' }
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const formatted = nomData.map(r => ({
        placeName: r.display_name,
        placeAddress: r.display_name,
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon)
      }));
      return res.json({ results: formatted, source: 'nominatim' });
    }
  } catch (err) {
    console.warn('[DineMind Proxy] Nominatim server-side search failed:', err.message);
  }

  return res.json({ results: [], source: 'none' });
});

module.exports = router;
