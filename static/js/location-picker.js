/**
 * DineMind AI — Location Picker
 * Uses Leaflet.js + OpenStreetMap (free, no API key needed)
 * Nominatim for geocoding and reverse geocoding
 */

const LocationPicker = (() => {
  let map = null;
  let marker = null;
  let selectedLat = null;
  let selectedLng = null;
  let selectedAddress = null;
  let selectedEmoji = '🍽️';
  let searchTimeout = null;
  let miniMap = null;
  let miniMarker = null;
  let isOpen = false;

  // ─── Nominatim API (free, no key needed) ───
  const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function searchAddress(query) {
    try {
      const res = await fetch(
        `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`,
        { headers: { 'Accept-Language': 'en' } }
      );
      return await res.json();
    } catch (e) {
      return [];
    }
  }

  // ─── Emoji Marker factory ───
  function createEmojiMarker(lat, lng, emoji, draggable = true) {
    const icon = L.divIcon({
      html: `<div class="lp-emoji-marker" id="lp-emoji-marker-el">${emoji}</div>`,
      iconSize: [48, 48],
      iconAnchor: [24, 48],
      className: '',
    });
    return L.marker([lat, lng], { icon, draggable });
  }

  // ─── Init Map ───
  function initMap() {
    if (map) return;

    map = L.map('lp-map', {
      center: [20.5937, 78.9629], // India center default
      zoom: 5,
      zoomControl: false,
    });

    // Custom zoom control position
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap tiles (free)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Click on map to set location
    map.on('click', async (e) => {
      await setLocation(e.latlng.lat, e.latlng.lng, true);
    });

    // Fix Leaflet map tiles not loading when modal opens
    setTimeout(() => map.invalidateSize(), 300);
  }

  // ─── Set Location ───
  async function setLocation(lat, lng, geocode = true) {
    selectedLat = lat;
    selectedLng = lng;

    // Remove old marker
    if (marker) map.removeLayer(marker);

    // Add emoji marker with drop animation
    marker = createEmojiMarker(lat, lng, selectedEmoji);
    marker.addTo(map);

    // Drag to fine-tune
    marker.on('dragend', async (e) => {
      const pos = e.target.getLatLng();
      await setLocation(pos.lat, pos.lng, true);
    });

    // Animate marker drop
    const markerEl = document.getElementById('lp-emoji-marker-el');
    if (markerEl) {
      markerEl.classList.add('lp-marker-drop');
      setTimeout(() => markerEl.classList.remove('lp-marker-drop'), 700);
    }

    // Enable confirm button
    const confirmBtn = document.getElementById('lp-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = false;

    if (geocode) {
      // Update status
      setInfoText('🔄 Getting address...');
      const data = await reverseGeocode(lat, lng);
      if (data && data.display_name) {
        selectedAddress = data.display_name;
        const addr = data.address || {};

        const city = addr.city || addr.town || addr.village || addr.county || '';
        const state = addr.state || '';
        const country = addr.country || '';
        const postcode = addr.postcode || '';

        // Update footer info
        setInfoText(`📍 ${truncate(data.display_name, 60)}`);

        // Show discovery card
        showDiscoveryCard(data.display_name, lat, lng, city, state, country, postcode);

        // Store extracted fields
        window._lpAddressData = { lat, lng, address: data.display_name, city, state, country, postcode };
      } else {
        selectedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setInfoText(`📍 Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
        window._lpAddressData = { lat, lng, address: selectedAddress, city: '', state: '', country: '', postcode: '' };
      }
    }

    // Smooth map pan to location
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 1.2 });
  }

  // ─── Discovery Card Animation ───
  function showDiscoveryCard(address, lat, lng, city, state, country, postcode) {
    const card = document.getElementById('lp-discovery-card');
    const addrEl = document.getElementById('lp-discovery-address');
    const metaEl = document.getElementById('lp-discovery-meta');
    const iconEl = document.getElementById('lp-discovery-icon');

    if (!card) return;

    if (addrEl) addrEl.textContent = address;
    if (metaEl) {
      metaEl.innerHTML = `
        ${city ? `<span class="lp-meta-chip">🏙️ ${city}</span>` : ''}
        ${state ? `<span class="lp-meta-chip">🗺️ ${state}</span>` : ''}
        ${country ? `<span class="lp-meta-chip">🌍 ${country}</span>` : ''}
        ${postcode ? `<span class="lp-meta-chip">📮 ${postcode}</span>` : ''}
        <span class="lp-meta-chip">📐 ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
      `;
    }
    if (iconEl) iconEl.textContent = selectedEmoji;

    card.style.display = 'flex';
    // Trigger animation
    card.classList.remove('lp-discovery-animate');
    void card.offsetWidth;
    card.classList.add('lp-discovery-animate');
  }

  // ─── GPS: Use My Location ───
  function useMyLocation() {
    if (!navigator.geolocation) {
      showStatus('❌ Geolocation is not supported by your browser.', 'error');
      return;
    }

    const loadingEl = document.getElementById('lp-map-loading');
    if (loadingEl) loadingEl.style.display = 'flex';
    setInfoText('🛰️ Detecting your GPS location...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (loadingEl) loadingEl.style.display = 'none';
        await setLocation(pos.coords.latitude, pos.coords.longitude, true);
        showStatus('✅ Location detected via GPS!', 'success');
      },
      (err) => {
        if (loadingEl) loadingEl.style.display = 'none';
        let msg = '❌ Could not detect location. ';
        if (err.code === 1) msg += 'Please allow location access in your browser.';
        else if (err.code === 2) msg += 'Position unavailable.';
        else msg += 'Request timed out.';
        setInfoText(msg);
        showStatus(msg, 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // ─── Search Input Handler ───
  function onSearchInput(value) {
    clearTimeout(searchTimeout);
    const list = document.getElementById('lp-suggestions-list');

    if (!value || value.length < 3) {
      if (list) list.style.display = 'none';
      return;
    }

    searchTimeout = setTimeout(async () => {
      const results = await searchAddress(value);
      renderSuggestions(results);
    }, 400);
  }

  function renderSuggestions(results) {
    const list = document.getElementById('lp-suggestions-list');
    if (!list) return;

    if (!results || results.length === 0) {
      list.innerHTML = '<div class="lp-suggestion-empty">No results found. Try a different search.</div>';
      list.style.display = 'block';
      return;
    }

    list.innerHTML = results.map((r, i) => `
      <div class="lp-suggestion-item" onclick="LocationPicker.selectSuggestion(${r.lat}, ${r.lon}, '${escapeJs(r.display_name)}')">
        <span class="lp-sug-icon">📍</span>
        <div class="lp-sug-text">
          <div class="lp-sug-name">${highlightMatch(r.display_name)}</div>
          <div class="lp-sug-type">${r.type || ''} ${r.address ? '· ' + (r.address.country || '') : ''}</div>
        </div>
      </div>
    `).join('');
    list.style.display = 'block';
  }

  async function selectSuggestion(lat, lng, name) {
    // Close suggestions
    const list = document.getElementById('lp-suggestions-list');
    if (list) list.style.display = 'none';

    // Update search input
    const input = document.getElementById('lp-search-input');
    if (input) input.value = name;

    await setLocation(parseFloat(lat), parseFloat(lng), true);
  }

  // ─── Marker Emoji Selector ───
  function selectMarker(btn, emoji) {
    selectedEmoji = emoji;

    // Update button states
    document.querySelectorAll('.lp-marker-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update existing marker on map
    if (marker && selectedLat) {
      map.removeLayer(marker);
      marker = createEmojiMarker(selectedLat, selectedLng, selectedEmoji);
      marker.addTo(map);
      marker.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        await setLocation(pos.lat, pos.lng, true);
      });
    }

    // Update discovery card icon
    const iconEl = document.getElementById('lp-discovery-icon');
    if (iconEl) iconEl.textContent = emoji;

    // Update hidden input
    const emojiInput = document.getElementById('signup-marker-emoji');
    if (emojiInput) emojiInput.value = emoji;
  }

  // ─── Confirm Location ───
  function confirmLocation() {
    if (!selectedLat || !selectedLng) return;

    const data = window._lpAddressData || {};

    // Populate hidden form fields
    setValue('signup-lat', data.lat || selectedLat);
    setValue('signup-lng', data.lng || selectedLng);
    setValue('signup-formatted-address', data.address || selectedAddress || '');
    setValue('signup-city', data.city || '');
    setValue('signup-country', data.country || '');
    setValue('signup-marker-emoji', selectedEmoji);

    // Update the trigger button to show location set
    const trigger = document.getElementById('location-picker-trigger');
    if (trigger) trigger.style.display = 'none';

    // Show preview card in signup form
    const previewCard = document.getElementById('location-preview-card');
    const previewAddr = document.getElementById('lp-preview-address');
    const previewCoords = document.getElementById('lp-preview-coords');
    const previewEmoji = document.getElementById('lp-preview-emoji');

    if (previewCard) previewCard.style.display = 'block';
    if (previewAddr) previewAddr.textContent = data.address || selectedAddress || '';
    if (previewCoords) previewCoords.textContent = `${(data.lat || selectedLat).toFixed(5)}, ${(data.lng || selectedLng).toFixed(5)}`;
    if (previewEmoji) previewEmoji.textContent = selectedEmoji;

    // Init mini preview map
    setTimeout(() => initMiniMap(data.lat || selectedLat, data.lng || selectedLng), 100);

    // Close modal
    close();

    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast('📍 Restaurant location set successfully!', 'success');
    }
  }

  function initMiniMap(lat, lng) {
    const container = document.getElementById('lp-preview-mini-map');
    if (!container || container._leaflet_id) return;

    miniMap = L.map(container, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(miniMap);

    const icon = L.divIcon({
      html: `<div class="lp-emoji-marker lp-mini-marker">${selectedEmoji}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      className: '',
    });
    L.marker([lat, lng], { icon }).addTo(miniMap);

    setTimeout(() => miniMap.invalidateSize(), 200);
  }

  // ─── Open / Close ───
  function open() {
    const overlay = document.getElementById('lp-modal-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    overlay.classList.remove('lp-modal-hide');
    overlay.classList.add('lp-modal-show');
    isOpen = true;

    // Init map after display (needs visible container)
    setTimeout(() => {
      initMap();
      if (map) map.invalidateSize();
    }, 150);

    // Close suggestions on outside click
    document.addEventListener('click', onOutsideClick, true);
  }

  function close() {
    const overlay = document.getElementById('lp-modal-overlay');
    if (!overlay) return;

    overlay.classList.remove('lp-modal-show');
    overlay.classList.add('lp-modal-hide');
    isOpen = false;

    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('lp-modal-hide');
    }, 300);

    document.removeEventListener('click', onOutsideClick, true);
  }

  function onOutsideClick(e) {
    const list = document.getElementById('lp-suggestions-list');
    const input = document.getElementById('lp-search-input');
    if (list && !list.contains(e.target) && e.target !== input) {
      list.style.display = 'none';
    }
  }

  // ─── Helpers ───
  function setInfoText(text) {
    const el = document.getElementById('lp-info-text');
    if (el) el.textContent = text;
  }

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function truncate(str, len) {
    return str && str.length > len ? str.slice(0, len) + '…' : str;
  }

  function escapeJs(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  function highlightMatch(text) {
    const input = document.getElementById('lp-search-input');
    if (!input || !input.value) return text;
    const q = input.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
  }

  function showStatus(msg, type) {
    if (typeof UI !== 'undefined' && UI.showToast) {
      UI.showToast(msg, type);
    }
  }

  // ─── Public API ───
  return {
    open,
    close,
    useMyLocation,
    onSearchInput,
    selectSuggestion,
    selectMarker,
    confirmLocation,
    getSelectedData: () => window._lpAddressData || null,
  };
})();
