/**
 * DineMind AI — Location Picker
 * OpenStreetMap + Leaflet.js + Nominatim (100% free, no API key)
 *
 * Architecture:
 *  - Modal opens → Leaflet map initializes with EXPLICIT 360px height (fixes blank map)
 *  - Search input → Nominatim API with 600ms debounce → dropdown
 *  - GPS → navigator.geolocation → flyTo + reverse geocode
 *  - Map click / drag marker → reverse geocode
 *  - confirmLocation() → fills hidden inputs → renders mini preview map in signup form
 */

const LocationPicker = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  let map = null;
  let marker = null;
  let miniMap = null;
  let selectedLat = null;
  let selectedLng = null;
  let selectedAddr = null;
  let selectedEmoji = '🍽️';
  let searchTimer = null;
  let isGeocoding = false;
  let currentSuggestions = []; // Local store for suggestions to prevent string escaping bugs

  // Layers for satellite view feature
  let streetLayer = null;
  let satelliteLayer = null;
  let currentLayerName = 'street';

  const NOMINATIM = 'https://nominatim.openstreetmap.org';

  // ── Emoji Marker Icon ──────────────────────────────────────────────────
  function makeIcon(emoji) {
    return L.divIcon({
      className: '',
      html: `<div class="lp-pin-wrap">
               <div class="lp-pin-body">${emoji}</div>
               <div class="lp-pin-shadow"></div>
             </div>`,
      iconSize: [52, 64],
      iconAnchor: [26, 60],
      popupAnchor: [0, -62],
    });
  }

  // ── Init Map ───────────────────────────────────────────────────────────
  function initMap() {
    if (map) {
      map.invalidateSize(true);
      return;
    }

    const el = document.getElementById('lp-map');
    if (!el) return;

    // Define layers
    streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    // CRITICAL: The div already has height:360px via inline style in HTML.
    map = L.map('lp-map', {
      center: [20.5937, 78.9629], // India center
      zoom: 5,
      zoomControl: true,
      scrollWheelZoom: true,
      layers: [streetLayer] // Default to Street layer
    });

    // Click on map → drop/move marker + reverse geocode
    map.on('click', (e) => {
      placeMarker(e.latlng.lat, e.latlng.lng, true);
    });

    // Bind search input AFTER map is init
    const input = document.getElementById('lp-search-input');
    if (input) {
      input.oninput = (e) => onSearch(e.target.value);
      input.onkeydown = (e) => {
        if (e.key === 'Escape') {
          closeDropdown();
        } else if (e.key === 'Enter') {
          e.preventDefault(); // Stop form submission
          clearTimeout(searchTimer);
          if (e.target.value.trim().length >= 3) {
            fetchSuggestions(e.target.value.trim());
          }
        }
      };
    }

    // Dropdown list event delegation (completely prevents quote escaping bugs)
    const dd = document.getElementById('lp-dropdown');
    if (dd) {
      dd.onclick = (e) => {
        const item = e.target.closest('.lp-dd-item');
        if (item) {
          const idx = parseInt(item.getAttribute('data-index'), 10);
          const suggestion = currentSuggestions[idx];
          if (suggestion) {
            _selectResult(parseFloat(suggestion.lat), parseFloat(suggestion.lon), suggestion.display_name);
          }
        }
      };
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      const section = document.getElementById('lp-search-section');
      if (section && !section.contains(e.target)) closeDropdown();
    }, true);
  }

  // ── Toggle Satellite View Layer ───────────────────────────────────────
  function toggleLayer() {
    if (!map) return;
    const btn = document.getElementById('lp-layer-toggle-btn');
    if (currentLayerName === 'street') {
      map.removeLayer(streetLayer);
      satelliteLayer.addTo(map);
      currentLayerName = 'satellite';
      if (btn) {
        btn.innerHTML = '🗺️ Map View';
        btn.classList.add('active');
      }
    } else {
      map.removeLayer(satelliteLayer);
      streetLayer.addTo(map);
      currentLayerName = 'street';
      if (btn) {
        btn.innerHTML = '🛰️ Satellite View';
        btn.classList.remove('active');
      }
    }
  }

  // ── Place / Move Marker ────────────────────────────────────────────────
  function placeMarker(lat, lng, doGeocode) {
    selectedLat = lat;
    selectedLng = lng;

    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng], {
        icon: makeIcon(selectedEmoji),
        draggable: true,
        title: 'Drag to fine-tune your location',
      }).addTo(map);

      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        selectedLat = pos.lat;
        selectedLng = pos.lng;
        reverseGeocode(pos.lat, pos.lng);
      });
    }

    // Enable confirm button
    const btn = document.getElementById('lp-confirm-btn');
    if (btn) btn.disabled = false;

    if (doGeocode) {
      reverseGeocode(lat, lng);
    }
  }

  // ── Reverse Geocode (Nominatim) ────────────────────────────────────────
  async function reverseGeocode(lat, lng) {
    if (isGeocoding) return;
    isGeocoding = true;
    setStatus('🔄 Getting address...');

    try {
      const res = await fetch(
        `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&email=dinemind-ai@restaurant.com`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();

      if (data && data.display_name) {
        selectedAddr = data.display_name;
        const a = data.address || {};

        const city    = a.city || a.town || a.village || a.county || '';
        const state   = a.state || '';
        const country = a.country || '';
        const postcode= a.postcode || '';

        setStatus(`📍 ${trunc(data.display_name, 65)}`);
        showFound(data.display_name, lat, lng, city, state, country, postcode);

        window._lpData = { lat, lng, address: data.display_name, city, state, country, postcode };
      } else {
        selectedAddr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setStatus(`📍 ${selectedAddr}`);
        window._lpData = { lat, lng, address: selectedAddr, city: '', state: '', country: '', postcode: '' };
      }
    } catch (err) {
      setStatus('⚠️ Could not fetch address. Location saved by coordinates.');
      window._lpData = { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: '', state: '', country: '', postcode: '' };
    } finally {
      isGeocoding = false;
    }
  }

  // ── Discovery Card ─────────────────────────────────────────────────────
  function showFound(address, lat, lng, city, state, country, postcode) {
    const card = document.getElementById('lp-found');
    if (!card) return;

    const addrEl  = document.getElementById('lp-found-addr');
    const chipsEl = document.getElementById('lp-found-chips');
    const iconEl  = document.getElementById('lp-found-emoji');

    if (addrEl) addrEl.textContent = address;
    if (iconEl) iconEl.textContent = selectedEmoji;
    if (chipsEl) {
      chipsEl.innerHTML = [
        city     && `<span class="lp-chip">🏙️ ${city}</span>`,
        state    && `<span class="lp-chip">🗺️ ${state}</span>`,
        country  && `<span class="lp-chip">🌍 ${country}</span>`,
        postcode && `<span class="lp-chip">📮 ${postcode}</span>`,
        `<span class="lp-chip">📐 ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`,
      ].filter(Boolean).join('');
    }

    card.style.display = 'flex';
    card.classList.remove('lp-found-anim');
    void card.offsetWidth;
    card.classList.add('lp-found-anim');

    // Smooth fly to location with zoom
    if (map) {
      map.flyTo([lat, lng], 16, { duration: 1.4, easeLinearity: 0.3 });
    }
  }

  // ── Search (Nominatim) ─────────────────────────────────────────────────
  function onSearch(value) {
    clearTimeout(searchTimer);

    if (!value || value.trim().length < 3) {
      closeDropdown();
      return;
    }

    searchTimer = setTimeout(() => fetchSuggestions(value.trim()), 600);
  }

  async function fetchSuggestions(query) {
    try {
      const res = await fetch(
        `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&email=dinemind-ai@restaurant.com`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const results = await res.json();
      currentSuggestions = results; // Store for event delegation selection
      renderDropdown(results, query);
    } catch (e) {
      closeDropdown();
    }
  }

  function renderDropdown(results, query) {
    const dd = document.getElementById('lp-dropdown');
    if (!dd) return;

    if (!results || results.length === 0) {
      dd.innerHTML = '<div class="lp-dd-empty">No results. Try a different search.</div>';
      dd.style.display = 'block';
      return;
    }

    dd.innerHTML = results.map((r, i) => `
      <div class="lp-dd-item" data-index="${i}">
        <span class="lp-dd-pin">📍</span>
        <div class="lp-dd-text">
          <div class="lp-dd-name">${highlight(r.display_name, query)}</div>
          <div class="lp-dd-type">${r.type || ''} ${r.address?.country ? '· ' + r.address.country : ''}</div>
        </div>
      </div>
    `).join('');

    dd.style.display = 'block';
  }

  function _selectResult(lat, lng, name) {
    closeDropdown();
    const input = document.getElementById('lp-search-input');
    if (input) input.value = name;
    placeMarker(lat, lng, true);
  }

  function closeDropdown() {
    const dd = document.getElementById('lp-dropdown');
    if (dd) dd.style.display = 'none';
  }

  // ── GPS ────────────────────────────────────────────────────────────────
  function useMyLocation() {
    if (!navigator.geolocation) {
      toast('❌ Geolocation is not supported by your browser.', 'error');
      return;
    }

    const bar = document.getElementById('lp-gps-bar');
    if (bar) bar.style.display = 'flex';
    setStatus('🛰️ Detecting GPS location...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (bar) bar.style.display = 'none';
        placeMarker(pos.coords.latitude, pos.coords.longitude, true);
        toast('✅ GPS location detected!', 'success');
      },
      (err) => {
        if (bar) bar.style.display = 'none';
        let msg = 'Location detection failed. ';
        if (err.code === 1) msg += 'Please allow location access in browser settings.';
        else if (err.code === 2) msg += 'Position unavailable.';
        else msg += 'Request timed out.';
        setStatus('❌ ' + msg);
        toast('❌ ' + msg, 'error');
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }

  // ── Quick GPS (from signup form button) ─────────────────────────────────
  function quickGPS() {
    if (!navigator.geolocation) {
      toast('❌ Geolocation not supported.', 'error');
      return;
    }

    const btn = document.getElementById('lp-gps-hero-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="lp-gps-pulse-ring"></span>🛰️ Detecting location...';
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Reverse geocode
        try {
          const res = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
            headers: { 'Accept-Language': 'en' }
          });
          const data = await res.json();
          const a = data?.address || {};
          window._lpData = {
            lat, lng,
            address: data?.display_name || `${lat.toFixed(5)},${lng.toFixed(5)}`,
            city: a.city || a.town || a.village || a.county || '',
            state: a.state || '',
            country: a.country || '',
            postcode: a.postcode || '',
          };
          selectedAddr = window._lpData.address;
          selectedLat = lat;
          selectedLng = lng;
          confirmLocation();
        } catch (e) {
          window._lpData = { lat, lng, address: `${lat.toFixed(5)},${lng.toFixed(5)}`, city: '', state: '', country: '', postcode: '' };
          selectedLat = lat;
          selectedLng = lng;
          selectedAddr = window._lpData.address;
          confirmLocation();
        }

        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span class="lp-gps-pulse-ring"></span>📍 Use My Current Location';
        }
      },
      (err) => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span class="lp-gps-pulse-ring"></span>📍 Use My Current Location';
        }
        let msg = 'Could not detect location. ';
        if (err.code === 1) msg += 'Allow location access in your browser.';
        toast('❌ ' + msg, 'error');
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }

  // ── Emoji Selector ─────────────────────────────────────────────────────
  function selectEmoji(btn, emoji) {
    selectedEmoji = emoji;

    document.querySelectorAll('.lp-emoji-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update marker on map
    if (marker) {
      marker.setIcon(makeIcon(emoji));
    }

    // Update discovery card icon
    const iconEl = document.getElementById('lp-found-emoji');
    if (iconEl) iconEl.textContent = emoji;

    // Update signup form emoji
    const sigEl = document.getElementById('lp-signup-preview-emoji');
    if (sigEl) sigEl.textContent = emoji;

    // Update hidden input
    const hidden = document.getElementById('signup-marker-emoji');
    if (hidden) hidden.value = emoji;
  }

  // ── Confirm Location ───────────────────────────────────────────────────
  function confirmLocation() {
    if (!selectedLat || !selectedLng) return;

    const d = window._lpData || {};
    const lat = d.lat || selectedLat;
    const lng = d.lng || selectedLng;
    const addr = d.address || selectedAddr || '';

    // Fill hidden form fields
    setVal('signup-lat', lat);
    setVal('signup-lng', lng);
    setVal('signup-formatted-address', addr);
    setVal('signup-city', d.city || '');
    setVal('signup-country', d.country || '');
    setVal('signup-marker-emoji', selectedEmoji);

    // Hide GPS hero + map trigger, show preview card
    const preview = document.getElementById('lp-signup-preview');
    const heroBtn = document.getElementById('lp-gps-hero-btn');
    const mapTrig = document.querySelector('.lp-map-trigger');

    if (preview) preview.style.display = 'block';
    if (heroBtn) heroBtn.style.display = 'none';
    if (mapTrig) mapTrig.style.display = 'none';

    // Fill preview card
    const eEl = document.getElementById('lp-signup-preview-emoji');
    const aEl = document.getElementById('lp-signup-preview-addr');
    const cEl = document.getElementById('lp-signup-preview-coords');
    const chEl = document.getElementById('lp-signup-preview-chips');

    if (eEl) eEl.textContent = selectedEmoji;
    if (aEl) aEl.textContent = addr;
    if (cEl) cEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (chEl) {
      chEl.innerHTML = [
        d.city     && `<span class="lp-chip">${d.city}</span>`,
        d.state    && `<span class="lp-chip">${d.state}</span>`,
        d.country  && `<span class="lp-chip">${d.country}</span>`,
        d.postcode && `<span class="lp-chip">📮 ${d.postcode}</span>`,
      ].filter(Boolean).join('');
    }

    // Init mini preview map in signup form
    setTimeout(() => initMiniMap(lat, lng), 120);

    // Close modal
    close();
    toast('📍 Restaurant location set successfully!', 'success');
  }

  // ── Mini Preview Map (in signup form) ──────────────────────────────────
  function initMiniMap(lat, lng) {
    const container = document.getElementById('lp-mini-map-box');
    if (!container || container._miniMap) return;
    container._miniMap = true;

    // Container must have explicit height (set via CSS)
    const mini = L.map(container, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      attributionControl: false,
      keyboard: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(mini);

    L.marker([lat, lng], { icon: makeIcon(selectedEmoji) }).addTo(mini);

    miniMap = mini;
    setTimeout(() => mini.invalidateSize(true), 200);
  }

  // ── Open / Close ───────────────────────────────────────────────────────
  function open() {
    const overlay = document.getElementById('lp-modal-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';

    // Must wait for the overlay to be displayed before initializing Leaflet
    // (Leaflet reads the container's pixel dimensions on L.map() init)
    setTimeout(() => {
      initMap();
      // Second call to ensure tiles rerender correctly
      setTimeout(() => { if (map) map.invalidateSize(true); }, 400);
    }, 50);
  }

  function close() {
    const overlay = document.getElementById('lp-modal-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';

    // Close any open dropdown
    closeDropdown();
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function setStatus(text) {
    const el = document.getElementById('lp-footer-status');
    if (el) el.textContent = text;
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function trunc(str, len) {
    return str && str.length > len ? str.slice(0, len) + '…' : (str || '');
  }

  function highlight(text, query) {
    if (!query) return text;
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
  }

  function toast(msg, type) {
    if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(msg, type);
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    open,
    close,
    quickGPS,
    useMyLocation,
    selectEmoji,
    confirmLocation,
    toggleLayer,
    _selectResult,
    getLocationData: () => window._lpData || null,
  };

})();
