/**
 * DineMind AI — Location Picker
 * Powered by Mappls (MapmyIndia) Web SDK v3.0 & Leaflet.js Dual Engine
 *
 * Requirements & Features:
 *  - Primary Engine: Official Mappls Map SDK v3.0 (Vector & Hybrid Satellite)
 *  - Automatic Fallback Engine: Leaflet.js + OpenStreetMap + Nominatim
 *  - Dynamic engine detection and seamless error recovery (handles 401 Unauthorized API keys gracefully)
 *  - Interactive map with Click-to-Pin and Draggable Emoji Marker
 *  - GPS Geolocation (Detect Current Location)
 *  - Address search / autocomplete with debounced API queries
 *  - Reverse geocoding (Auto-fills Address, City, State, Country, Postcode)
 *  - Business Icon / Emoji Marker selector
 *  - Mini preview map on signup form
 */

const LocationPicker = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  let map = null;
  let marker = null;
  let miniMap = null;
  let activeEngine = 'mappls'; // 'mappls' or 'leaflet'
  let selectedLat = 28.6139;   // Default: New Delhi / India
  let selectedLng = 77.2090;
  let selectedAddr = '';
  let selectedEmoji = '🍽️';
  let searchTimer = null;
  let isGeocoding = false;
  let currentSuggestions = [];
  let currentLayerType = 'vector'; // vector or hybrid/satellite
  let mapplsApiKey = 'mdwallaqjppbxotocjucfjxjronwpotbclru';
  let leafletTileLayer = null;

  // Tile endpoints for Leaflet Fallback
  const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ESRI_SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  // ── Ensure window.mappls is always defined if present ───────────────────
  function getMappls() {
    if (typeof window !== 'undefined') {
      if (window.Mappls && !window.mappls) window.mappls = window.Mappls;
      if (window.mappls && !window.Mappls) window.Mappls = window.mappls;
      return window.mappls || window.Mappls || null;
    }
    return null;
  }

  // ── Custom Leaflet Pin Icon Generator ──────────────────────────────────
  function makeLeafletIcon(emoji) {
    if (typeof L === 'undefined') return null;
    const char = emoji || selectedEmoji || '🍽️';
    return L.divIcon({
      className: 'lp-custom-pin-wrap',
      html: `
        <div class="lp-custom-pin-body" data-emoji="${char}">
          <span class="lp-pin-emoji">${char}</span>
        </div>
        <div class="lp-custom-pin-pulse"></div>
      `,
      iconSize: [44, 52],
      iconAnchor: [22, 48],
      popupAnchor: [0, -45]
    });
  }

  // ── Load Mappls SDK dynamically if needed ──────────────────────────────
  async function fetchServerConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        if (config.mapplsApiKey) {
          mapplsApiKey = config.mapplsApiKey;
        }
      }
    } catch (e) {
      console.warn('DineMind AI: Using fallback client configuration.');
    }
  }

  async function tryLoadMapplsSdk() {
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
          } else if (attempts++ > 15) {
            clearInterval(checkInterval);
            reject(new Error('Mappls SDK window object not found'));
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'mappls-sdk-script';
      script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${mapplsApiKey}`;
      script.async = true;
      script.onload = () => {
        const sdk = getMappls();
        if (sdk && sdk.Map) {
          resolve(sdk);
        } else {
          reject(new Error('Mappls SDK loaded without Map module'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to fetch Mappls Web SDK bundle'));
      };
      document.head.appendChild(script);
    });
  }

  // ── Load Leaflet dynamically if not on page ───────────────────────────
  async function ensureLeafletLoaded() {
    if (typeof L !== 'undefined') return true;

    return new Promise((resolve, reject) => {
      if (!document.getElementById('leaflet-css-fallback')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-fallback';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const script = document.createElement('script');
      script.id = 'leaflet-js-fallback';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Failed to load Leaflet script fallback'));
      document.head.appendChild(script);
    });
  }

  // ── Main Map Initialization ───────────────────────────────────────────
  async function initMap() {
    const mapEl = document.getElementById('lp-map');
    if (!mapEl) return;

    // Reset container if recreating
    if (map) {
      try {
        if (typeof map.remove === 'function') map.remove();
      } catch (e) {}
      map = null;
      marker = null;
    }

    mapEl.innerHTML = '';

    // Attempt Mappls initialization first
    try {
      const M = await tryLoadMapplsSdk();
      if (M && M.Map) {
        map = new M.Map('lp-map', {
          center: [selectedLat, selectedLng],
          zoom: 15,
          zoomControl: true,
          hybrid: false,
          location: true,
        });

        activeEngine = 'mappls';
        setStatus('🗺️ Mappls Map (MapmyIndia) Active');

        map.addListener('click', (e) => {
          if (e && e.lngLat) {
            placeMarker(e.lngLat.lat, e.lngLat.lng, true);
          }
        });

        map.on('load', () => {
          placeMarker(selectedLat, selectedLng, true);
        });

        setupSearchAndListeners();
        return;
      }
    } catch (err) {
      console.warn('Mappls SDK unavailable or unauthorized (401). Falling back to OpenStreetMap / Leaflet engine.', err.message);
    }

    // Fallback to Leaflet + OpenStreetMap engine
    try {
      await ensureLeafletLoaded();
      activeEngine = 'leaflet';

      map = L.map(mapEl, {
        center: [selectedLat, selectedLng],
        zoom: 15,
        zoomControl: true,
      });

      leafletTileLayer = L.tileLayer(OSM_TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      map.on('click', (e) => {
        placeMarker(e.latlng.lat, e.latlng.lng, true);
      });

      placeMarker(selectedLat, selectedLng, true);
      setStatus('🗺️ OpenStreetMap Active (Fallback Mode)');

      setTimeout(() => {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize(true);
        }
      }, 250);

      setupSearchAndListeners();
    } catch (fallbackErr) {
      console.error('Map initialization failed on both engines:', fallbackErr);
      setStatus('⚠️ Map service offline. Search address or use GPS.');
    }
  }

  // ── Setup Event Listeners for Search & Dropdown ────────────────────────
  function setupSearchAndListeners() {
    const input = document.getElementById('lp-search-input');
    if (input && !input._lpInit) {
      input._lpInit = true;
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

    const dd = document.getElementById('lp-dropdown');
    if (dd && !dd._lpInit) {
      dd._lpInit = true;
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

    if (!document._lpOutsideClick) {
      document._lpOutsideClick = true;
      document.addEventListener('click', (e) => {
        const section = document.getElementById('lp-search-section');
        if (section && !section.contains(e.target)) closeDropdown();
      }, true);
    }
  }

  // ── Toggle Satellite / Vector Layer ────────────────────────────────────
  function toggleLayer() {
    if (!map) return;
    const btn = document.getElementById('lp-layer-toggle-btn');

    if (activeEngine === 'mappls') {
      try {
        if (currentLayerType === 'vector') {
          if (typeof map.setLayer === 'function') map.setLayer('hybrid');
          currentLayerType = 'hybrid';
          if (btn) btn.innerHTML = '🗺️ Map View';
        } else {
          if (typeof map.setLayer === 'function') map.setLayer('vector');
          currentLayerType = 'vector';
          if (btn) btn.innerHTML = '🛰️ Satellite View';
        }
      } catch (e) {
        console.log('Mappls layer toggle handled:', e.message);
      }
    } else if (activeEngine === 'leaflet') {
      if (currentLayerType === 'vector') {
        if (leafletTileLayer && map) map.removeLayer(leafletTileLayer);
        leafletTileLayer = L.tileLayer(ESRI_SATELLITE_URL, {
          maxZoom: 18,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(map);
        currentLayerType = 'hybrid';
        if (btn) btn.innerHTML = '🗺️ Map View';
      } else {
        if (leafletTileLayer && map) map.removeLayer(leafletTileLayer);
        leafletTileLayer = L.tileLayer(OSM_TILE_URL, {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        currentLayerType = 'vector';
        if (btn) btn.innerHTML = '🛰️ Satellite View';
      }
    }
  }

  // ── Place / Move Marker ────────────────────────────────────────────────
  function placeMarker(lat, lng, doGeocode = true) {
    selectedLat = lat;
    selectedLng = lng;

    if (!map) return;

    if (activeEngine === 'mappls') {
      const M = getMappls();
      if (M) {
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
          if (marker.setPosition) marker.setPosition({ lat: lat, lng: lng });
        }
        if (map.setCenter) map.setCenter({ lat: lat, lng: lng });
      }
    } else if (activeEngine === 'leaflet') {
      if (!marker) {
        marker = L.marker([lat, lng], {
          icon: makeLeafletIcon(selectedEmoji),
          draggable: true,
        }).addTo(map);

        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          selectedLat = pos.lat;
          selectedLng = pos.lng;
          reverseGeocode(pos.lat, pos.lng);
        });
      } else {
        marker.setLatLng([lat, lng]);
        marker.setIcon(makeLeafletIcon(selectedEmoji));
      }
      map.panTo([lat, lng]);
    }

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
    setStatus('🔄 Locating address...');

    // 1. If on Mappls engine, try Mappls pinCode / rev_geocode
    if (activeEngine === 'mappls') {
      const M = getMappls();
      try {
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
      } catch (e) {
        console.warn('Mappls rev_geocode failed, trying Nominatim fallback...');
      }
    }

    // 2. Fallback to Nominatim Reverse Geocoding API
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        const a = data.address || {};
        const city = a.city || a.town || a.village || a.suburb || '';
        const state = a.state || '';
        const country = a.country || 'India';
        const postcode = a.postcode || '';

        selectedAddr = addr;
        setStatus(`📍 ${trunc(addr, 65)}`);
        showFound(addr, lat, lng, city, state, country, postcode);
        window._lpData = { lat, lng, address: addr, city, state, country, postcode };
        isGeocoding = false;
        return;
      }
    } catch (err) {
      console.warn('Nominatim reverse geocoding failed:', err);
    }

    // 3. Fallback coordinates label
    const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    selectedAddr = coordStr;
    setStatus(`📍 ${coordStr}`);
    showFound(coordStr, lat, lng, '', '', 'India', '');
    window._lpData = { lat, lng, address: coordStr, city: '', state: '', country: 'India', postcode: '' };
    isGeocoding = false;
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

    searchTimer = setTimeout(() => fetchSuggestions(value.trim()), 400);
  }

  async function fetchSuggestions(query) {
    // 1. Try Mappls search if on Mappls engine
    if (activeEngine === 'mappls') {
      const M = getMappls();
      try {
        if (M && typeof M.search === 'function') {
          M.search(query, { location: [selectedLat, selectedLng] }, (data) => {
            if (data && data.data) {
              currentSuggestions = data.data;
              renderDropdown(data.data, query);
            }
          });
          return;
        }

        const res = await fetch(`https://atlas.mappls.com/api/places/search/json?query=${encodeURIComponent(query)}&access_token=${mapplsApiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.suggestedLocations) {
            currentSuggestions = data.suggestedLocations;
            renderDropdown(data.suggestedLocations, query);
            return;
          }
        }
      } catch (e) {
        console.warn('Mappls search failed, falling back to Nominatim...');
      }
    }

    // 2. Fallback Nominatim Search API
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&countrycodes=in`);
      if (res.ok) {
        const results = await res.json();
        currentSuggestions = results.map(r => ({
          placeName: r.display_name,
          placeAddress: r.display_name,
          latitude: parseFloat(r.lat),
          longitude: parseFloat(r.lon)
        }));
        renderDropdown(currentSuggestions, query);
        return;
      }
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

    if (activeEngine === 'leaflet' && marker) {
      marker.setIcon(makeLeafletIcon(emoji));
    }

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

    try {
      container.innerHTML = '';

      if (activeEngine === 'mappls') {
        const M = getMappls();
        if (M && M.Map) {
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
          return;
        }
      }

      // Leaflet Mini Map Fallback
      if (typeof L !== 'undefined') {
        const mini = L.map(container, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          attributionControl: false,
        });

        L.tileLayer(OSM_TILE_URL, { maxZoom: 19 }).addTo(mini);
        L.marker([lat, lng], { icon: makeLeafletIcon(selectedEmoji) }).addTo(mini);
        miniMap = mini;
        setTimeout(() => mini.invalidateSize(true), 200);
      }
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
