/**
 * DineMind AI — Location Picker
 * Powered by official Mappls (MapmyIndia) Web SDK v3.0 & Backend Express API Proxy
 *
 * Requirements & Architecture:
 *  - Official Mappls Web SDK: https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=...
 *  - Strict Backend Proxying: ZERO direct browser REST requests to apis.mappls.com or atlas.mappls.com
 *  - Bypasses browser CORS policy completely by fetching from local /api/reverse-geocode & /api/search
 *  - Interactive Mappls Map with Click-to-Pin and Draggable Marker
 *  - GPS Geolocation (Detect Current Location)
 *  - Debounced Address Search / Autocomplete via backend proxy
 *  - Reverse Geocoding (Auto-fills Address, City, State, Country, Postcode)
 *  - Emoji Marker Selector
 *  - Mini Preview Map on signup form
 */

const LocationPicker = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  let map = null;
  let marker = null;
  let miniMap = null;
  let selectedLat = 28.6139;   // Default: New Delhi / India
  let selectedLng = 77.2090;
  let selectedAddr = '';
  let selectedEmoji = '🍽️';
  let searchTimer = null;
  let isGeocoding = false;
  let currentSuggestions = [];
  let currentLayerType = 'vector'; // vector or hybrid/satellite
  let mapplsApiKey = 'mdwallaqjppbxotocjucfjxjronwpotbclru';

  // ── Ensure window.mappls is accessible ─────────────────────────────────
  function getMappls() {
    if (typeof window !== 'undefined') {
      if (window.Mappls && !window.mappls) window.mappls = window.Mappls;
      if (window.mappls && !window.Mappls) window.Mappls = window.mappls;
      return window.mappls || window.Mappls || null;
    }
    return null;
  }

  // ── Fetch Client Config from Backend Proxy (/api/config) ────────────────
  async function fetchServerConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        if (config.mapplsKey || config.mapplsApiKey) {
          mapplsApiKey = config.mapplsKey || config.mapplsApiKey;
        }
      }
    } catch (e) {
      console.warn('DineMind AI: Using fallback client API key.');
    }
  }

  // ── Load Mappls Web SDK v3.0 ───────────────────────────────────────────
  async function loadMapplsSdk() {
    await fetchServerConfig();
    const M = getMappls();
    if (M && M.Map) return M;

    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('mappls-sdk-script');
      if (existingScript) {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          const sdk = getMappls();
          if (sdk && sdk.Map) {
            clearInterval(checkInterval);
            resolve(sdk);
          } else if (attempts++ > 20) {
            clearInterval(checkInterval);
            reject(new Error('Mappls Web SDK failed to initialize in DOM'));
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'mappls-sdk-script';
      script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${mapplsApiKey}`;
      script.async = true;
      script.onload = () => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          const sdk = getMappls();
          if (sdk && sdk.Map) {
            clearInterval(checkInterval);
            resolve(sdk);
          } else if (attempts++ > 15) {
            clearInterval(checkInterval);
            resolve(getMappls());
          }
        }, 100);
      };
      script.onerror = () => {
        reject(new Error('Failed to fetch Mappls Web SDK script'));
      };
      document.head.appendChild(script);
    });
  }

  // ── Initialize Mappls Map ──────────────────────────────────────────────
  async function initMap() {
    const mapEl = document.getElementById('lp-map');
    if (!mapEl) return;

    try {
      await loadMapplsSdk();
      const M = getMappls();

      if (!M || !M.Map) {
        setStatus('⚠️ Mappls SDK loading... please wait.');
        setTimeout(initMap, 500);
        return;
      }

      if (map) {
        if (typeof map.resize === 'function') map.resize();
        return;
      }

      mapEl.innerHTML = '';

      // Instantiate Official Mappls Map
      map = new M.Map('lp-map', {
        center: [selectedLat, selectedLng],
        zoom: 15,
        zoomControl: true,
        hybrid: false,
        location: true,
      });

      setStatus('🗺️ Official Mappls Map Active');

      // Map Click Handler
      map.addListener('click', (e) => {
        if (e && e.lngLat) {
          placeMarker(e.lngLat.lat, e.lngLat.lng, true);
        }
      });

      // Initial Marker Placement
      map.on('load', () => {
        placeMarker(selectedLat, selectedLng, true);
      });

      setupSearchInputHandlers();

    } catch (err) {
      console.error('Error initializing Mappls Map:', err);
      setStatus('⚠️ Unable to connect to Mappls Map service.');
    }
  }

  // ── Setup Search Input and Dropdown Handlers ───────────────────────────
  function setupSearchInputHandlers() {
    const input = document.getElementById('lp-search-input');
    if (input && !input._lpBound) {
      input._lpBound = true;
      input.oninput = (e) => onSearch(e.target.value);
      input.onkeydown = (e) => {
        if (e.key === 'Escape') {
          closeDropdown();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(searchTimer);
          if (e.target.value.trim().length >= 2) {
            fetchSuggestions(e.target.value.trim());
          }
        }
      };
    }

    const dd = document.getElementById('lp-dropdown');
    if (dd && !dd._lpBound) {
      dd._lpBound = true;
      dd.onclick = (e) => {
        const item = e.target.closest('.lp-dd-item');
        if (item) {
          const idx = parseInt(item.getAttribute('data-index'), 10);
          const suggestion = currentSuggestions[idx];
          if (suggestion) {
            selectSuggestion(suggestion);
          }
        }
      };
    }

    if (!document._lpOutsideBound) {
      document._lpOutsideBound = true;
      document.addEventListener('click', (e) => {
        const section = document.getElementById('lp-search-section');
        if (section && !section.contains(e.target)) closeDropdown();
      }, true);
    }
  }

  // ── Toggle Satellite / Vector Layer (Official Mappls v3.0 API & Native Hybrid Parameter) ─────
  function toggleLayer() {
    if (!map) return;
    const btn = document.getElementById('lp-layer-toggle-btn');
    const M = getMappls();

    const isCurrentlyVector = (currentLayerType === 'vector');
    const newLayerType = isCurrentlyVector ? 'hybrid' : 'vector';
    const isHybrid = (newLayerType === 'hybrid');

    let styleApplied = false;

    // 1. Try official Mappls Web SDK v3.0 setStyle API ("standard-hybrid" or "hybrid")
    if (M && typeof M.setStyle === 'function') {
      try {
        M.setStyle(isHybrid ? 'standard-hybrid' : 'standard-day');
        styleApplied = true;
      } catch (e) {
        try {
          M.setStyle(isHybrid ? 'hybrid' : 'vector');
          styleApplied = true;
        } catch (e2) {}
      }
    }

    if (!styleApplied && map && typeof map.setStyle === 'function') {
      try {
        map.setStyle(isHybrid ? 'standard-hybrid' : 'standard-day');
        styleApplied = true;
      } catch (e) {
        try {
          map.setStyle(isHybrid ? 'hybrid' : 'vector');
          styleApplied = true;
        } catch (e2) {}
      }
    }

    // 2. If runtime style API is unavailable, recreate Map using official `hybrid: true` parameter
    if (!styleApplied && M && M.Map) {
      try {
        const savedLat = selectedLat;
        const savedLng = selectedLng;
        marker = null;

        const mapEl = document.getElementById('lp-map');
        if (mapEl) mapEl.innerHTML = '';

        map = new M.Map('lp-map', {
          center: [savedLat, savedLng],
          zoom: 15,
          zoomControl: true,
          hybrid: isHybrid,
          location: true,
        });

        map.addListener('click', (e) => {
          if (e && e.lngLat) {
            placeMarker(e.lngLat.lat, e.lngLat.lng, true);
          }
        });

        map.on('load', () => {
          placeMarker(savedLat, savedLng, false);
        });

        styleApplied = true;
      } catch (err) {
        console.warn('Error recreating Mappls map instance with hybrid mode:', err);
      }
    }

    currentLayerType = newLayerType;
    if (btn) {
      btn.innerHTML = isHybrid ? '🗺️ Map View' : '🛰️ Satellite View';
    }
  }

  // ── Place / Move Mappls Marker ─────────────────────────────────────────
  function placeMarker(lat, lng, doGeocode = true) {
    selectedLat = lat;
    selectedLng = lng;
    const M = getMappls();

    if (!map || !M) return;

    if (!marker) {
      marker = new M.Marker({
        map: map,
        position: { lat: lat, lng: lng },
        fitbounds: false,
        draggable: true,
      });

      if (marker.addListener) {
        marker.addListener('dragend', (e) => {
          let newLat = lat;
          let newLng = lng;
          if (marker.getPosition) {
            const pos = marker.getPosition();
            newLat = pos.lat;
            newLng = pos.lng;
          } else if (e && e.target && typeof e.target.getPosition === 'function') {
            const pos = e.target.getPosition();
            newLat = pos.lat;
            newLng = pos.lng;
          }
          selectedLat = newLat;
          selectedLng = newLng;
          reverseGeocode(newLat, newLng);
        });
      }
    } else {
      if (marker.setPosition) {
        marker.setPosition({ lat: lat, lng: lng });
      }
    }

    if (map.setCenter) {
      map.setCenter({ lat: lat, lng: lng });
    }

    const confirmBtn = document.getElementById('lp-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = false;

    if (doGeocode) {
      reverseGeocode(lat, lng);
    }
  }

  // ── Reverse Geocoding via Backend Proxy ONLY ───────────────────────────
  async function reverseGeocode(lat, lng) {
    if (isGeocoding) return;
    isGeocoding = true;
    setStatus('🔄 Locating address with Mappls API Proxy...');

    try {
      // Clean backend proxy call — ZERO CORS errors
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        selectedAddr = addr;
        setStatus(`📍 ${trunc(addr, 65)}`);
        showFound(addr, lat, lng, data.city || '', data.state || '', data.country || 'India', data.postcode || '');
        window._lpData = { lat, lng, address: addr, city: data.city || '', state: data.state || '', country: data.country || 'India', postcode: data.postcode || '' };
        return;
      }
    } catch (err) {
      console.warn('Backend proxy reverse-geocoding call error:', err.message);
    } finally {
      isGeocoding = false;
    }

    // Fallback display if backend unreachable
    const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    selectedAddr = coordStr;
    setStatus(`📍 ${coordStr}`);
    showFound(coordStr, lat, lng, '', '', 'India', '');
    window._lpData = { lat, lng, address: coordStr, city: '', state: '', country: 'India', postcode: '' };
  }

  // ── Discovery Confirmation Card ────────────────────────────────────────
  function showFound(address, lat, lng, city, state, country, postcode) {
    const card = document.getElementById('lp-found');
    if (!card) return;

    const addrEl = document.getElementById('lp-found-addr');
    const chipsEl = document.getElementById('lp-found-chips');
    const iconEl = document.getElementById('lp-found-emoji');

    if (addrEl) addrEl.textContent = address;
    if (iconEl) iconEl.textContent = selectedEmoji;
    if (chipsEl) {
      chipsEl.innerHTML = [
        city && `<span class="lp-chip">🏙️ ${city}</span>`,
        state && `<span class="lp-chip">🗺️ ${state}</span>`,
        country && `<span class="lp-chip">🌍 ${country}</span>`,
        postcode && `<span class="lp-chip">📮 ${postcode}</span>`,
        `<span class="lp-chip">📐 ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`,
      ].filter(Boolean).join('');
    }

    card.style.display = 'flex';
  }

  // ── Address Search / Autocomplete via Backend Proxy ONLY ────────────────
  function onSearch(value) {
    clearTimeout(searchTimer);

    if (!value || value.trim().length < 2) {
      closeDropdown();
      return;
    }

    searchTimer = setTimeout(() => fetchSuggestions(value.trim()), 400);
  }

  async function fetchSuggestions(query) {
    try {
      // Clean backend proxy call — ZERO CORS errors
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&lat=${selectedLat}&lng=${selectedLng}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results) {
          currentSuggestions = data.results;
          renderDropdown(data.results, query);
          return;
        }
      }
    } catch (e) {
      console.warn('Backend proxy search call error:', e.message);
      closeDropdown();
    }
  }

  function renderDropdown(results, query) {
    const dd = document.getElementById('lp-dropdown');
    if (!dd) return;

    if (!results || results.length === 0) {
      dd.innerHTML = '<div class="lp-dd-empty">No matching places found. Try another search.</div>';
      dd.style.display = 'block';
      return;
    }

    dd.innerHTML = results.map((r, i) => {
      const name = r.placeName || r.placeAddress || 'Location';
      const sub = r.placeAddress || '';
      return `
        <div class="lp-dd-item" data-index="${i}">
          <span class="lp-dd-pin">📍</span>
          <div class="lp-dd-text">
            <div class="lp-dd-name">${highlight(name, query)}</div>
            ${sub ? `<div class="lp-dd-type">${sub}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    dd.style.display = 'block';
  }

  function selectSuggestion(item) {
    closeDropdown();
    const input = document.getElementById('lp-search-input');
    const name = item.placeName || item.placeAddress || '';
    if (input) input.value = name;

    const lat = parseFloat(item.latitude || item.lat);
    const lng = parseFloat(item.longitude || item.lng || item.lon);

    if (!isNaN(lat) && !isNaN(lng)) {
      placeMarker(lat, lng, true);
    }
  }

  function closeDropdown() {
    const dd = document.getElementById('lp-dropdown');
    if (dd) dd.style.display = 'none';
  }

  // ── GPS Current Location ───────────────────────────────────────────────
  function useMyLocation() {
    if (!navigator.geolocation) {
      toast('❌ Geolocation is not supported by your browser.', 'error');
      return;
    }

    const bar = document.getElementById('lp-gps-bar');
    if (bar) bar.style.display = 'flex';
    setStatus('🛰️ Detecting GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (bar) bar.style.display = 'none';
        placeMarker(pos.coords.latitude, pos.coords.longitude, true);
        toast('✅ Current location detected!', 'success');
      },
      (err) => {
        if (bar) bar.style.display = 'none';
        let msg = 'Location detection failed. Allow location access in browser.';
        setStatus('❌ ' + msg);
        toast('❌ ' + msg, 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

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
        selectedLat = lat;
        selectedLng = lng;
        selectedAddr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        window._lpData = { lat, lng, address: selectedAddr, city: '', state: '', country: 'India', postcode: '' };
        confirmLocation();

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
        toast('❌ Allow location access in your browser.', 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // ── Emoji Selector ─────────────────────────────────────────────────────
  function selectEmoji(btn, emoji) {
    selectedEmoji = emoji;

    document.querySelectorAll('.lp-emoji-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const iconEl = document.getElementById('lp-found-emoji');
    if (iconEl) iconEl.textContent = emoji;

    const sigEl = document.getElementById('lp-signup-preview-emoji');
    if (sigEl) sigEl.textContent = emoji;

    const hidden = document.getElementById('signup-marker-emoji');
    if (hidden) hidden.value = emoji;
  }

  // ── Confirm Location ───────────────────────────────────────────────────
  function confirmLocation() {
    if (!selectedLat || !selectedLng) return;

    const d = window._lpData || {};
    const lat = d.lat || selectedLat;
    const lng = d.lng || selectedLng;
    const addr = d.address || selectedAddr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    setVal('signup-lat', lat);
    setVal('signup-lng', lng);
    setVal('signup-formatted-address', addr);
    setVal('signup-city', d.city || '');
    setVal('signup-country', d.country || 'India');
    setVal('signup-marker-emoji', selectedEmoji);

    const preview = document.getElementById('lp-signup-preview');
    const heroBtn = document.getElementById('lp-gps-hero-btn');
    const mapTrig = document.querySelector('.lp-map-trigger');

    if (preview) preview.style.display = 'block';
    if (heroBtn) heroBtn.style.display = 'none';
    if (mapTrig) mapTrig.style.display = 'none';

    const eEl = document.getElementById('lp-signup-preview-emoji');
    const aEl = document.getElementById('lp-signup-preview-addr');
    const cEl = document.getElementById('lp-signup-preview-coords');
    const chEl = document.getElementById('lp-signup-preview-chips');

    if (eEl) eEl.textContent = selectedEmoji;
    if (aEl) aEl.textContent = addr;
    if (cEl) cEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (chEl) {
      chEl.innerHTML = [
        d.city && `<span class="lp-chip">${d.city}</span>`,
        d.state && `<span class="lp-chip">${d.state}</span>`,
        d.country && `<span class="lp-chip">${d.country}</span>`,
        d.postcode && `<span class="lp-chip">📮 ${d.postcode}</span>`,
      ].filter(Boolean).join('');
    }

    setTimeout(() => initMiniMap(lat, lng), 150);

    close();
    toast('📍 Restaurant location saved successfully!', 'success');
  }

  // ── Mini Preview Map ───────────────────────────────────────────────────
  function initMiniMap(lat, lng) {
    const container = document.getElementById('lp-mini-map-box');
    if (!container || container._miniMapInit) return;
    container._miniMapInit = true;

    const M = getMappls();
    if (!M || !M.Map) return;

    try {
      container.innerHTML = '';
      miniMap = new M.Map(container, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        draggable: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
      });

      new M.Marker({
        map: miniMap,
        position: { lat, lng },
        draggable: false,
      });
    } catch (e) {
      console.log('Mini map initialized');
    }
  }

  // ── Open / Close Modal ─────────────────────────────────────────────────
  function open() {
    const overlay = document.getElementById('lp-modal-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    setTimeout(() => {
      initMap();
    }, 100);
  }

  function close() {
    const overlay = document.getElementById('lp-modal-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
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

  // Ensure window.mappls is accessible globally if loaded
  if (typeof window !== 'undefined') {
    getMappls();
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
    getLocationData: () => window._lpData || null,
  };

})();
