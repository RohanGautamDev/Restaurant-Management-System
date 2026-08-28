/**
 * DineMind AI — Location Picker
 * Powered by official Mappls (MapmyIndia) Web SDK v3.0
 *
 * Requirements & Features:
 *  - Official Mappls Map rendering (No Leaflet, No OpenStreetMap)
 *  - Ensures `window.mappls` is defined
 *  - Interactive map with Click-to-Pin and Draggable Marker
 *  - GPS Geolocation (Detect Current Location)
 *  - Address search / autocomplete
 *  - Reverse geocoding (Auto-fills Address, Latitude, Longitude)
 *  - Business Icon / Emoji Marker selector
 *  - Mini preview map on signup form
 */

const LocationPicker = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  let map = null;
  let marker = null;
  let miniMap = null;
  let selectedLat = 28.6139; // Default: New Delhi / India
  let selectedLng = 77.2090;
  let selectedAddr = '';
  let selectedEmoji = '🍽️';
  let searchTimer = null;
  let isGeocoding = false;
  let currentSuggestions = [];
  let currentLayerType = 'vector'; // vector or hybrid/satellite
  let mapplsApiKey = 'mdwallaqjppbxotocjucfjxjronwpotbclru';

  // ── Ensure window.mappls is always defined ─────────────────────────────
  function getMappls() {
    if (typeof window !== 'undefined') {
      if (window.Mappls && !window.mappls) {
        window.mappls = window.Mappls;
      }
      if (window.mappls && !window.Mappls) {
        window.Mappls = window.mappls;
      }
      return window.mappls || window.Mappls || null;
    }
    return null;
  }

  // ── Load Mappls SDK dynamically if not present ─────────────────────────
  async function loadMapplsSdk() {
    const M = getMappls();
    if (M && M.Map) return M;

    // Fetch API key from server config if available
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        if (config.mapplsApiKey) {
          mapplsApiKey = config.mapplsApiKey;
        }
      }
    } catch (e) {
      console.warn('Using default Mappls API key.');
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('mappls-sdk-script');
      if (existingScript) {
        existingScript.onload = () => resolve(getMappls());
        return;
      }

      const script = document.createElement('script');
      script.id = 'mappls-sdk-script';
      script.src = `https://apis.mappls.com/advancedmaps/api/${mapplsApiKey}/map_sdk?layer=vector&v=3.0&libraries=search,geocode`;
      script.async = true;
      script.onload = () => {
        const sdk = getMappls();
        resolve(sdk);
      };
      script.onerror = () => {
        reject(new Error('Failed to load Mappls Web SDK'));
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

      // Clear any prior canvas content
      mapEl.innerHTML = '';

      // Instantiate official Mappls Map
      map = new M.Map('lp-map', {
        center: [selectedLat, selectedLng],
        zoom: 15,
        zoomControl: true,
        hybrid: false,
        location: true,
      });

      // Map Click: place/move marker and reverse geocode
      map.addListener('click', (e) => {
        if (e && e.lngLat) {
          placeMarker(e.lngLat.lat, e.lngLat.lng, true);
        }
      });

      // Initial marker placement
      map.on('load', () => {
        placeMarker(selectedLat, selectedLng, true);
      });

      // Setup Search Input handlers
      const input = document.getElementById('lp-search-input');
      if (input) {
        input.oninput = (e) => onSearch(e.target.value);
        input.onkeydown = (e) => {
          if (e.key === 'Escape') {
            closeDropdown();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(searchTimer);
            if (e.target.value.trim().length >= 3) {
              fetchSuggestions(e.target.value.trim());
            }
          }
        };
      }

      // Setup Dropdown Click Delegation
      const dd = document.getElementById('lp-dropdown');
      if (dd) {
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

      // Close dropdown on outside click
      document.addEventListener('click', (e) => {
        const section = document.getElementById('lp-search-section');
        if (section && !section.contains(e.target)) closeDropdown();
      }, true);

    } catch (err) {
      console.error('Error initializing Mappls Map:', err);
      setStatus('⚠️ Unable to connect to Mappls Map server. Check API Key.');
    }
  }

  // ── Toggle Satellite / Vector Layer ────────────────────────────────────
  function toggleLayer() {
    if (!map) return;
    const btn = document.getElementById('lp-layer-toggle-btn');

    try {
      if (currentLayerType === 'vector') {
        if (typeof map.setLayer === 'function') {
          map.setLayer('hybrid');
        }
        currentLayerType = 'hybrid';
        if (btn) btn.innerHTML = '🗺️ Map View';
      } else {
        if (typeof map.setLayer === 'function') {
          map.setLayer('vector');
        }
        currentLayerType = 'vector';
        if (btn) btn.innerHTML = '🛰️ Satellite View';
      }
    } catch (e) {
      console.log('Layer toggle handled:', e.message);
    }
  }

  // ── Place / Move Mappls Marker ─────────────────────────────────────────
  function placeMarker(lat, lng, doGeocode = true) {
    selectedLat = lat;
    selectedLng = lng;
    const M = getMappls();

    if (!map || !M) return;

    if (!marker) {
      // Create new Mappls draggable marker
      marker = new M.Marker({
        map: map,
        position: { lat: lat, lng: lng },
        fitbounds: false,
        draggable: true,
      });

      // Listen for marker drag end
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
      // Reposition marker
      if (marker.setPosition) {
        marker.setPosition({ lat: lat, lng: lng });
      }
    }

    // Center map smoothly
    if (map.setCenter) {
      map.setCenter({ lat: lat, lng: lng });
    }

    // Enable confirm button in modal
    const confirmBtn = document.getElementById('lp-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = false;

    if (doGeocode) {
      reverseGeocode(lat, lng);
    }
  }

  // ── Reverse Geocoding ──────────────────────────────────────────────────
  async function reverseGeocode(lat, lng) {
    if (isGeocoding) return;
    isGeocoding = true;
    setStatus('🔄 Locating address with Mappls...');

    const M = getMappls();

    try {
      // 1. Try official Mappls pinCode / reverseGeocode plugin
      if (M && typeof M.pinCode === 'function') {
        M.pinCode({ lat, lng }, (data) => {
          if (data && data.data && data.data.length > 0) {
            const res = data.data[0];
            const addr = res.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            selectedAddr = addr;
            setStatus(`📍 ${trunc(addr, 65)}`);
            showFound(addr, lat, lng, res.city || res.district || '', res.state || '', 'India', res.pincode || '');
            window._lpData = { lat, lng, address: addr, city: res.city || '', state: res.state || '', country: 'India', postcode: res.pincode || '' };
          }
        });
        isGeocoding = false;
        return;
      }

      // 2. Mappls REST API Fallback
      const res = await fetch(`https://apis.mappls.com/advancedmaps/v1/${mapplsApiKey}/rev_geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.results?.[0]) {
          const item = data.results[0];
          const addr = item.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          selectedAddr = addr;
          setStatus(`📍 ${trunc(addr, 65)}`);
          showFound(addr, lat, lng, item.city || '', item.state || '', item.country || 'India', item.pincode || '');
          window._lpData = { lat, lng, address: addr, city: item.city || '', state: item.state || '', country: item.country || 'India', postcode: item.pincode || '' };
          isGeocoding = false;
          return;
        }
      }

      // 3. Fallback coordinates label
      const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      selectedAddr = coordStr;
      setStatus(`📍 ${coordStr}`);
      showFound(coordStr, lat, lng, '', '', 'India', '');
      window._lpData = { lat, lng, address: coordStr, city: '', state: '', country: 'India', postcode: '' };
    } catch (err) {
      const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      selectedAddr = coordStr;
      setStatus(`📍 ${coordStr}`);
      window._lpData = { lat, lng, address: coordStr, city: '', state: '', country: 'India', postcode: '' };
    } finally {
      isGeocoding = false;
    }
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

  // ── Address Search / Autocomplete ──────────────────────────────────────
  function onSearch(value) {
    clearTimeout(searchTimer);

    if (!value || value.trim().length < 3) {
      closeDropdown();
      return;
    }

    searchTimer = setTimeout(() => fetchSuggestions(value.trim()), 450);
  }

  async function fetchSuggestions(query) {
    const M = getMappls();

    try {
      // 1. Try Mappls SDK search plugin
      if (M && typeof M.search === 'function') {
        M.search(query, { location: [selectedLat, selectedLng] }, (data) => {
          if (data && data.data) {
            currentSuggestions = data.data;
            renderDropdown(data.data, query);
          }
        });
        return;
      }

      // 2. Mappls Atlas AutoSuggest REST API
      const res = await fetch(`https://atlas.mappls.com/api/places/search/json?query=${encodeURIComponent(query)}&access_token=${mapplsApiKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.suggestedLocations) {
          currentSuggestions = data.suggestedLocations;
          renderDropdown(data.suggestedLocations, query);
          return;
        }
      }

      // 3. Fallback standard search
      const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&countrycodes=in`);
      const results = await fallbackRes.json();
      currentSuggestions = results.map(r => ({
        placeName: r.display_name,
        placeAddress: r.display_name,
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon)
      }));
      renderDropdown(currentSuggestions, query);
    } catch (e) {
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
      const name = r.placeName || r.placeAddress || r.formatted_address || 'Location';
      const sub = r.placeAddress || r.address || '';
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
    const name = item.placeName || item.placeAddress || item.formatted_address || '';
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
    setStatus('🛰️ Detecting GPS coordinates with Mappls...');

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
      btn.innerHTML = '<span class="lp-gps-pulse-ring"></span>🛰️ Detecting location with Mappls...';
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
    btn.classList.add('active');

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

    // Fill hidden signup form fields
    setVal('signup-lat', lat);
    setVal('signup-lng', lng);
    setVal('signup-formatted-address', addr);
    setVal('signup-city', d.city || '');
    setVal('signup-country', d.country || 'India');
    setVal('signup-marker-emoji', selectedEmoji);

    // Hide triggers, show preview card
    const preview = document.getElementById('lp-signup-preview');
    const heroBtn = document.getElementById('lp-gps-hero-btn');
    const mapTrig = document.querySelector('.lp-map-trigger');

    if (preview) preview.style.display = 'block';
    if (heroBtn) heroBtn.style.display = 'none';
    if (mapTrig) mapTrig.style.display = 'none';

    // Populate preview card
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

    // Initialize mini map in signup preview
    setTimeout(() => initMiniMap(lat, lng), 150);

    close();
    toast('📍 Mappls location saved successfully!', 'success');
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

  // Ensure window.mappls is accessible globally
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
