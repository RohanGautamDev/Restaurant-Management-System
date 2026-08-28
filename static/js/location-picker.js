/**
 * DineMind AI — Location Picker
 * Uses REAL Google Maps JavaScript API
 * API key loaded from server → /api/config → process.env.GOOGLE_MAPS_API_KEY
 *
 * Flow:
 *   1. LocationPicker.open() → fetch /api/config → get Google Maps API key
 *   2. Load Google Maps JS API dynamically
 *   3. Create map with Places Autocomplete + Geocoder
 *   4. GPS, draggable marker, emoji selector, discovery animation
 *   5. confirmLocation() → fills hidden form fields → mini preview map
 */

const LocationPicker = (() => {
  // ── State ──────────────────────────────────────────────────────────────
  let googleMap = null;
  let mapMarker = null;
  let geocoder = null;
  let autocomplete = null;
  let selectedLat = null;
  let selectedLng = null;
  let selectedAddress = '';
  let selectedEmoji = '🍽️';
  let mapsApiKey = null;
  let mapsLoaded = false;
  let miniMap = null;
  let miniMarker = null;

  // ── Load Google Maps API dynamically ───────────────────────────────────
  async function loadGoogleMapsAPI(apiKey) {
    if (mapsLoaded || window.google?.maps) {
      mapsLoaded = true;
      return true;
    }

    return new Promise((resolve, reject) => {
      if (!apiKey) {
        reject(new Error('No Google Maps API key configured.'));
        return;
      }

      // Callback name to signal load complete
      window.__gmaps_cb = () => {
        mapsLoaded = true;
        resolve(true);
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__gmaps_cb&loading=async`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps.'));
      document.head.appendChild(script);
    });
  }

  // ── Fetch API key from server ───────────────────────────────────────────
  async function fetchApiKey() {
    if (mapsApiKey !== null) return mapsApiKey;
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      mapsApiKey = data.googleMapsKey || '';
    } catch (e) {
      mapsApiKey = '';
    }
    return mapsApiKey;
  }

  // ── Init Google Map inside modal ────────────────────────────────────────
  function initGoogleMap() {
    if (googleMap) {
      // Map already exists — just resize
      google.maps.event.trigger(googleMap, 'resize');
      return;
    }

    const mapDiv = document.getElementById('lp-map');
    if (!mapDiv) return;

    // Default center: India
    const defaultCenter = { lat: 20.5937, lng: 78.9629 };

    googleMap = new google.maps.Map(mapDiv, {
      center: defaultCenter,
      zoom: 5,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0d1225' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1225' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bc9' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2140' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6279a0' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060c1e' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#111827' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#5a7099' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#111827' }] },
        { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1e2d4f' }] },
        { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#4e6a9a' }] },
        { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0d1225' }] },
      ],
    });

    geocoder = new google.maps.Geocoder();

    // Click on map → drop marker + reverse geocode
    googleMap.addListener('click', (event) => {
      placeMarker(event.latLng.lat(), event.latLng.lng(), true);
    });

    // Setup Places Autocomplete on the search input
    setupAutocomplete();
  }

  // ── Places Autocomplete ─────────────────────────────────────────────────
  function setupAutocomplete() {
    const input = document.getElementById('lp-search-input');
    if (!input || !google?.maps?.places) return;

    autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      types: ['establishment', 'geocode'],
    });

    // Style the autocomplete dropdown
    injectAutocompleteStyles();

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) {
        showToast('⚠️ Please select a location from the dropdown.', 'error');
        return;
      }
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      placeMarker(lat, lng, false);
      fillAddressFromPlace(place);
    });
  }

  // ── Place / Move Marker ─────────────────────────────────────────────────
  function placeMarker(lat, lng, reverseGeocode) {
    selectedLat = lat;
    selectedLng = lng;

    const pos = { lat, lng };

    if (mapMarker) {
      // Animate marker to new position
      mapMarker.setPosition(pos);
    } else {
      // Create custom emoji marker
      mapMarker = new google.maps.Marker({
        position: pos,
        map: googleMap,
        draggable: true,
        animation: google.maps.Animation.DROP,
        icon: makeGoogleMarkerIcon(selectedEmoji),
        title: 'Your Restaurant Location',
      });

      // Drag end → reverse geocode new position
      mapMarker.addListener('dragend', (e) => {
        const newLat = e.latLng.lat();
        const newLng = e.latLng.lng();
        selectedLat = newLat;
        selectedLng = newLng;
        doReverseGeocode(newLat, newLng);
      });
    }

    // Smooth fly-to
    googleMap.panTo(pos);
    googleMap.setZoom(Math.max(googleMap.getZoom(), 16));

    // Enable confirm button
    enableConfirm(true);

    if (reverseGeocode) {
      doReverseGeocode(lat, lng);
    }
  }

  // ── Custom Marker Icon ──────────────────────────────────────────────────
  function makeGoogleMarkerIcon(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = 52;
    canvas.height = 52;
    const ctx = canvas.getContext('2d');

    // Gold circle background
    ctx.beginPath();
    ctx.arc(26, 24, 22, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(10,14,30,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,200,66,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Emoji
    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 26, 24);

    return {
      url: canvas.toDataURL(),
      scaledSize: new google.maps.Size(52, 52),
      anchor: new google.maps.Point(26, 52),
    };
  }

  // ── Reverse Geocode via Google Geocoder ─────────────────────────────────
  function doReverseGeocode(lat, lng) {
    setInfoText('🔄 Getting address from Google Maps...');
    if (!geocoder) return;

    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const place = results[0];
        selectedAddress = place.formatted_address;
        fillAddressFromGeocodeResult(place, lat, lng);
      } else {
        selectedAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setInfoText(`📍 ${selectedAddress}`);
        window._lpAddressData = { lat, lng, address: selectedAddress, city: '', state: '', country: '', postcode: '' };
        showDiscoveryCard(selectedAddress, lat, lng, '', '', '', '');
      }
    });
  }

  // ── Extract Address Components ──────────────────────────────────────────
  function fillAddressFromPlace(place) {
    const comps = place.address_components || [];
    const addr = extractAddressComponents(comps);
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    selectedAddress = place.formatted_address;
    window._lpAddressData = { lat, lng, address: selectedAddress, ...addr };
    setInfoText(`📍 ${truncate(selectedAddress, 60)}`);
    showDiscoveryCard(selectedAddress, lat, lng, addr.city, addr.state, addr.country, addr.postcode);
    enableConfirm(true);
  }

  function fillAddressFromGeocodeResult(result, lat, lng) {
    const comps = result.address_components || [];
    const addr = extractAddressComponents(comps);
    selectedAddress = result.formatted_address;
    window._lpAddressData = { lat, lng, address: selectedAddress, ...addr };
    setInfoText(`📍 ${truncate(selectedAddress, 60)}`);
    showDiscoveryCard(selectedAddress, lat, lng, addr.city, addr.state, addr.country, addr.postcode);
  }

  function extractAddressComponents(components) {
    const get = (type) => {
      const c = components.find(c => c.types.includes(type));
      return c ? c.long_name : '';
    };
    return {
      city: get('locality') || get('administrative_area_level_2') || get('sublocality_level_1'),
      state: get('administrative_area_level_1'),
      country: get('country'),
      postcode: get('postal_code'),
    };
  }

  // ── GPS: Use My Location ────────────────────────────────────────────────
  function useMyLocation() {
    if (!navigator.geolocation) {
      showToast('❌ Geolocation not supported by your browser.', 'error');
      return;
    }

    const loadingEl = document.getElementById('lp-map-loading');
    if (loadingEl) loadingEl.style.display = 'flex';
    setInfoText('🛰️ Detecting your GPS location...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (loadingEl) loadingEl.style.display = 'none';
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        placeMarker(lat, lng, true);
        showToast('✅ GPS location detected!', 'success');
      },
      (err) => {
        if (loadingEl) loadingEl.style.display = 'none';
        let msg = 'Could not get location. ';
        if (err.code === 1) msg += 'Please allow location access in your browser settings.';
        else if (err.code === 2) msg += 'Position unavailable.';
        else msg += 'Request timed out.';
        showToast('❌ ' + msg, 'error');
        setInfoText('❌ ' + msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // ── Discovery Animation Card ────────────────────────────────────────────
  function showDiscoveryCard(address, lat, lng, city, state, country, postcode) {
    const card = document.getElementById('lp-discovery-card');
    if (!card) return;

    const addrEl = document.getElementById('lp-discovery-address');
    const metaEl = document.getElementById('lp-discovery-meta');
    const iconEl = document.getElementById('lp-discovery-icon');

    if (addrEl) addrEl.textContent = address;
    if (iconEl) iconEl.textContent = selectedEmoji;
    if (metaEl) {
      metaEl.innerHTML = [
        city    && `<span class="lp-meta-chip">🏙️ ${city}</span>`,
        state   && `<span class="lp-meta-chip">🗺️ ${state}</span>`,
        country && `<span class="lp-meta-chip">🌍 ${country}</span>`,
        postcode&& `<span class="lp-meta-chip">📮 ${postcode}</span>`,
        `<span class="lp-meta-chip">📐 ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`,
      ].filter(Boolean).join('');
    }

    card.style.display = 'flex';
    card.classList.remove('lp-discovery-animate');
    void card.offsetWidth;
    card.classList.add('lp-discovery-animate');
  }

  // ── Marker Emoji Selector ───────────────────────────────────────────────
  function selectMarker(btn, emoji) {
    selectedEmoji = emoji;
    document.querySelectorAll('.lp-marker-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update Google marker icon
    if (mapMarker) {
      mapMarker.setIcon(makeGoogleMarkerIcon(emoji));
    }

    const iconEl = document.getElementById('lp-discovery-icon');
    if (iconEl) iconEl.textContent = emoji;

    const emojiInput = document.getElementById('signup-marker-emoji');
    if (emojiInput) emojiInput.value = emoji;
  }

  // ── Confirm Location ────────────────────────────────────────────────────
  function confirmLocation() {
    if (!selectedLat || !selectedLng) return;

    const data = window._lpAddressData || {};
    const lat = data.lat || selectedLat;
    const lng = data.lng || selectedLng;

    // Populate hidden form fields
    setValue('signup-lat', lat);
    setValue('signup-lng', lng);
    setValue('signup-formatted-address', data.address || selectedAddress || '');
    setValue('signup-city', data.city || '');
    setValue('signup-country', data.country || '');
    setValue('signup-marker-emoji', selectedEmoji);

    // Hide trigger, show preview
    const trigger = document.getElementById('location-picker-trigger');
    if (trigger) trigger.style.display = 'none';

    const previewCard = document.getElementById('location-preview-card');
    const previewAddr = document.getElementById('lp-preview-address');
    const previewCoords = document.getElementById('lp-preview-coords');
    const previewEmoji = document.getElementById('lp-preview-emoji');

    if (previewCard) previewCard.style.display = 'block';
    if (previewAddr) previewAddr.textContent = data.address || selectedAddress || '';
    if (previewCoords) previewCoords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (previewEmoji) previewEmoji.textContent = selectedEmoji;

    // Mini preview map using Google Maps Static API
    setTimeout(() => initMiniPreviewMap(lat, lng), 120);

    close();
    showToast('📍 Restaurant location confirmed!', 'success');
  }

  function initMiniPreviewMap(lat, lng) {
    const container = document.getElementById('lp-preview-mini-map');
    if (!container || container._gmapInit) return;
    container._gmapInit = true;

    miniMap = new google.maps.Map(container, {
      center: { lat, lng },
      zoom: 16,
      disableDefaultUI: true,
      gestureHandling: 'none',
      styles: [ // Same dark style
        { elementType: 'geometry', stylers: [{ color: '#0d1225' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bc9' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2140' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060c1e' }] },
        { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0d1225' }] },
      ],
    });

    new google.maps.Marker({
      position: { lat, lng },
      map: miniMap,
      icon: makeGoogleMarkerIcon(selectedEmoji),
    });
  }

  // ── Open Modal ──────────────────────────────────────────────────────────
  async function open() {
    const overlay = document.getElementById('lp-modal-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    overlay.classList.add('lp-modal-show');

    // Show loading state in map while we load API
    const loadingEl = document.getElementById('lp-map-loading');

    try {
      const apiKey = await fetchApiKey();

      if (!apiKey) {
        // No API key — show setup instructions inside modal
        showNoKeyMessage();
        return;
      }

      if (loadingEl) {
        loadingEl.style.display = 'flex';
        loadingEl.innerHTML = `<div class="lp-loading-spinner"></div><span>Loading Google Maps...</span>`;
      }

      await loadGoogleMapsAPI(apiKey);

      if (loadingEl) loadingEl.style.display = 'none';

      // Init map AFTER modal is visible (needs visible container for sizing)
      setTimeout(() => {
        initGoogleMap();
        if (googleMap) google.maps.event.trigger(googleMap, 'resize');
      }, 200);

    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      console.error('LocationPicker:', err);
      showNoKeyMessage(err.message);
    }
  }

  // ── No API Key Message ──────────────────────────────────────────────────
  function showNoKeyMessage(customMsg) {
    const mapDiv = document.getElementById('lp-map');
    if (!mapDiv) return;

    mapDiv.innerHTML = `
      <div class="lp-nokey-screen">
        <div class="lp-nokey-icon">🗝️</div>
        <h3 class="lp-nokey-title">Google Maps API Key Required</h3>
        <p class="lp-nokey-body">${customMsg || 'To enable the interactive map, add your Google Maps API key to the Vercel environment variables.'}</p>
        <div class="lp-nokey-steps">
          <div class="lp-step">
            <span class="lp-step-num">1</span>
            <span>Go to <strong>console.cloud.google.com</strong></span>
          </div>
          <div class="lp-step">
            <span class="lp-step-num">2</span>
            <span>Create a project → Enable <strong>Maps JavaScript API</strong> + <strong>Places API</strong></span>
          </div>
          <div class="lp-step">
            <span class="lp-step-num">3</span>
            <span>Create an API Key → Copy it</span>
          </div>
          <div class="lp-step">
            <span class="lp-step-num">4</span>
            <span>In Vercel dashboard → <strong>Settings → Environment Variables</strong><br>
            Add: <code>GOOGLE_MAPS_API_KEY</code> = <em>your key</em></span>
          </div>
          <div class="lp-step">
            <span class="lp-step-num">5</span>
            <span>Redeploy on Vercel → Map works! 🎉</span>
          </div>
        </div>
        <p class="lp-nokey-free">💡 Google Maps gives <strong>$200 free credit/month</strong> — enough for a portfolio project at no cost.</p>
      </div>
    `;
  }

  // ── Close Modal ─────────────────────────────────────────────────────────
  function close() {
    const overlay = document.getElementById('lp-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('lp-modal-show');
    overlay.classList.add('lp-modal-hide');
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('lp-modal-hide');
    }, 300);
  }

  // ── Inject Google Autocomplete Dropdown Styles ──────────────────────────
  function injectAutocompleteStyles() {
    if (document.getElementById('gm-autocomplete-style')) return;
    const style = document.createElement('style');
    style.id = 'gm-autocomplete-style';
    style.textContent = `
      .pac-container {
        background: rgba(10,14,30,0.98) !important;
        border: 1px solid rgba(79,142,255,0.3) !important;
        border-top: none !important;
        border-radius: 0 0 12px 12px !important;
        box-shadow: 0 16px 50px rgba(0,0,0,0.7) !important;
        z-index: 99999 !important;
        font-family: 'Inter', sans-serif !important;
      }
      .pac-item {
        background: transparent !important;
        border-top: 1px solid rgba(255,255,255,0.05) !important;
        color: #a0b0d0 !important;
        padding: 10px 16px !important;
        font-size: 13px !important;
        cursor: pointer !important;
        transition: background 0.15s !important;
      }
      .pac-item:hover, .pac-item-selected {
        background: rgba(79,142,255,0.1) !important;
      }
      .pac-item-query {
        color: #e0e8ff !important;
        font-weight: 600 !important;
        font-size: 13px !important;
      }
      .pac-icon { filter: invert(0.6) !important; }
      .pac-matched { color: #f5c842 !important; font-weight: 700 !important; }
    `;
    document.head.appendChild(style);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function setInfoText(text) {
    const el = document.getElementById('lp-info-text');
    if (el) el.textContent = text;
  }

  function enableConfirm(yes) {
    const btn = document.getElementById('lp-confirm-btn');
    if (btn) btn.disabled = !yes;
  }

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function truncate(str, len) {
    return str && str.length > len ? str.slice(0, len) + '…' : str;
  }

  function showToast(msg, type) {
    if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(msg, type);
  }

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    open,
    close,
    useMyLocation,
    selectMarker,
    confirmLocation,
    getSelectedData: () => window._lpAddressData || null,
  };
})();
