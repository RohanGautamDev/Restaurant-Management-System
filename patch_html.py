"""
Patch index.html:
1. Add Leaflet CSS in <head> 
2. Replace signup form location section
3. Replace old broken modal with clean new one
4. Add Leaflet JS before location-picker.js
"""
import re

with open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Add Leaflet CSS in <head> ───
OLD_CSS = '  <link rel="stylesheet" href="/static/css/responsive.css">\n</head>'
NEW_CSS = '''  <link rel="stylesheet" href="/static/css/responsive.css">

  <!-- Leaflet.js (OpenStreetMap - 100% free, no API key) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
</head>'''
content = content.replace(OLD_CSS, NEW_CSS)

# ─── 2. Replace signup form location section ───
OLD_LOC = '''        <!-- ─── RESTAURANT LOCATION PICKER ─── -->
        <div class="gate-form-group">
          <label class="form-label">📍 Restaurant Location</label>
          <div class="location-picker-trigger" id="location-picker-trigger" onclick="LocationPicker.open()">
            <div class="lp-trigger-icon">🗺️</div>
            <div class="lp-trigger-text">
              <span class="lp-trigger-title">Set Your Shop Location on Map</span>
              <span class="lp-trigger-hint">Tap to open map · use GPS or search</span>
            </div>
            <div class="lp-trigger-arrow">›</div>
          </div>

          <!-- Location preview card (hidden until location selected) -->
          <div class="location-preview-card" id="location-preview-card" style="display:none;">
            <div class="lp-preview-map" id="lp-preview-mini-map"></div>
            <div class="lp-preview-info">
              <div class="lp-preview-emoji" id="lp-preview-emoji">🍽️</div>
              <div class="lp-preview-details">
                <div class="lp-preview-address" id="lp-preview-address">Address loading...</div>
                <div class="lp-preview-coords" id="lp-preview-coords"></div>
              </div>
              <button type="button" class="lp-preview-edit" onclick="LocationPicker.open()" title="Change Location">✏️</button>
            </div>
            <div class="lp-preview-success-badge">✅ Location Set</div>
          </div>

          <!-- Hidden data fields -->
          <input type="hidden" id="signup-lat" name="lat">
          <input type="hidden" id="signup-lng" name="lng">
          <input type="hidden" id="signup-formatted-address" name="formatted_address">
          <input type="hidden" id="signup-city" name="city">
          <input type="hidden" id="signup-country" name="country">
          <input type="hidden" id="signup-marker-emoji" name="marker_emoji" value="🍽️">
        </div>'''

NEW_LOC = '''        <!-- ─── RESTAURANT LOCATION ─── -->
        <div class="gate-form-group">
          <label class="form-label">📍 Restaurant Location <span style="color:var(--text-3);font-weight:400;font-size:0.72rem;">(optional)</span></label>

          <!-- Large GPS Button -->
          <button type="button" class="lp-gps-hero-btn" id="lp-gps-hero-btn" onclick="LocationPicker.quickGPS()">
            <span class="lp-gps-pulse-ring"></span>
            📍 Use My Current Location
          </button>

          <!-- Map Picker Trigger -->
          <div class="lp-map-trigger" onclick="LocationPicker.open()">
            <span>🗺️</span>
            <span>Pick Location on Interactive Map</span>
            <span style="margin-left:auto;opacity:0.5;">›</span>
          </div>

          <!-- Location Preview (hidden until location selected) -->
          <div class="lp-signup-preview" id="lp-signup-preview" style="display:none;">
            <div class="lp-mini-map-box" id="lp-mini-map-box"></div>
            <div class="lp-signup-preview-body">
              <div class="lp-signup-preview-top">
                <span class="lp-signup-preview-emoji" id="lp-signup-preview-emoji">🍽️</span>
                <div style="flex:1;min-width:0;">
                  <div class="lp-signup-preview-addr" id="lp-signup-preview-addr">Loading...</div>
                  <div class="lp-signup-preview-coords" id="lp-signup-preview-coords"></div>
                </div>
                <button type="button" class="lp-signup-preview-edit" onclick="LocationPicker.open()">✏️ Edit</button>
              </div>
              <div class="lp-signup-preview-chips" id="lp-signup-preview-chips"></div>
              <div class="lp-signup-preview-success">✅ Restaurant location confirmed!</div>
            </div>
          </div>

          <!-- Hidden form data -->
          <input type="hidden" id="signup-lat">
          <input type="hidden" id="signup-lng">
          <input type="hidden" id="signup-formatted-address">
          <input type="hidden" id="signup-city">
          <input type="hidden" id="signup-country">
          <input type="hidden" id="signup-marker-emoji" value="🍽️">
        </div>'''

content = content.replace(OLD_LOC, NEW_LOC)

# ─── 3. Replace script tag + old modal ───
OLD_SCRIPTS_AND_MODAL = '''  <!-- ═══════════════════════════════════════════════
       JAVASCRIPT MODULES
       ════════════════════════════════════════════════ -->
  <script src="/static/js/api.js"></script>
  <script src="/static/js/animations.js"></script>
  <script src="/static/js/components.js"></script>
  <script src="/static/js/dashboard.js"></script>
  <script src="/static/js/app.js"></script>

  <!-- Google Maps + Location Picker (load last) -->
  <script src="/static/js/location-picker.js"></script>

  <!-- ═══════════════════════════════════════════════
       LOCATION PICKER MODAL
       ════════════════════════════════════════════════ -->
  <div id="lp-modal-overlay" class="lp-modal-overlay" style="display:none;">
    <div class="lp-modal">

      <!-- Modal Header -->
      <div class="lp-modal-header">
        <div class="lp-modal-header-left">
          <div class="lp-modal-icon">📍</div>
          <div>
            <h2 class="lp-modal-title">Find Your Restaurant</h2>
            <p class="lp-modal-subtitle">Search, drop a pin, or use GPS to mark your location</p>
          </div>
        </div>
        <button class="lp-modal-close" onclick="LocationPicker.close()">✕</button>
      </div>

      <!-- Search Bar -->
      <div class="lp-search-bar">
        <span class="lp-search-icon">🔍</span>
        <input
          type="text"
          id="lp-search-input"
          class="lp-search-input"
          placeholder="Search address, area, city..."
          oninput="LocationPicker.onSearchInput(this.value)"
          autocomplete="off"
        />
        <button class="lp-gps-btn" onclick="LocationPicker.useMyLocation()" title="Use GPS Location">
          <span class="lp-gps-icon">🛰️</span>
          <span>My Location</span>
        </button>
      </div>

      <!-- Search Suggestions Dropdown: handled by Google Places Autocomplete -->

      <!-- Map Container -->
      <div class="lp-map-wrap">
        <div id="lp-map" class="lp-map"></div>

        <!-- Map overlay: GPS loading -->
        <div class="lp-map-loading" id="lp-map-loading" style="display:none;">
          <div class="lp-loading-spinner"></div>
          <span>Detecting your location...</span>
        </div>

        <!-- Map Center Crosshair -->
        <div class="lp-map-crosshair" id="lp-map-crosshair" style="display:none;">
          <div class="lp-crosshair-ring"></div>
        </div>
      </div>

      <!-- Marker Type Selector -->
      <div class="lp-marker-selector">
        <span class="lp-marker-label">Choose your restaurant icon:</span>
        <div class="lp-marker-options" id="lp-marker-options">
          <button class="lp-marker-opt active" data-emoji="🍽️" onclick="LocationPicker.selectMarker(this, '🍽️')">🍽️</button>
          <button class="lp-marker-opt" data-emoji="☕" onclick="LocationPicker.selectMarker(this, '☕')">☕</button>
          <button class="lp-marker-opt" data-emoji="🍕" onclick="LocationPicker.selectMarker(this, '🍕')">🍕</button>
          <button class="lp-marker-opt" data-emoji="🍔" onclick="LocationPicker.selectMarker(this, '🍔')">🍔</button>
          <button class="lp-marker-opt" data-emoji="🍜" onclick="LocationPicker.selectMarker(this, '🍜')">🍜</button>
          <button class="lp-marker-opt" data-emoji="🥗" onclick="LocationPicker.selectMarker(this, '🥗')">🥗</button>
          <button class="lp-marker-opt" data-emoji="🍣" onclick="LocationPicker.selectMarker(this, '🍣')">🍣</button>
          <button class="lp-marker-opt" data-emoji="🌮" onclick="LocationPicker.selectMarker(this, '🌮')">🌮</button>
          <button class="lp-marker-opt" data-emoji="🍰" onclick="LocationPicker.selectMarker(this, '🍰')">🍰</button>
          <button class="lp-marker-opt" data-emoji="🥐" onclick="LocationPicker.selectMarker(this, '🥐')">🥐</button>
        </div>
      </div>

      <!-- Discovery Confirmation Card (hidden until location confirmed) -->
      <div class="lp-discovery-card" id="lp-discovery-card" style="display:none;">
        <div class="lp-discovery-icon" id="lp-discovery-icon">🍽️</div>
        <div class="lp-discovery-text">
          <div class="lp-discovery-title">🎉 Great! We found your restaurant location!</div>
          <div class="lp-discovery-address" id="lp-discovery-address"></div>
          <div class="lp-discovery-meta" id="lp-discovery-meta"></div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="lp-modal-footer">
        <div class="lp-selected-info" id="lp-selected-info">
          <span class="lp-info-icon">📌</span>
          <span id="lp-info-text">Click anywhere on the map or search to set location</span>
        </div>
        <div class="lp-footer-btns">
          <button class="btn btn-glass" onclick="LocationPicker.close()">Cancel</button>
          <button class="btn btn-gold" id="lp-confirm-btn" onclick="LocationPicker.confirmLocation()" disabled>
            <span>✅</span> <span>Confirm Location</span>
          </button>
        </div>
      </div>

    </div>
  </div>

</body>
</html>'''

NEW_SCRIPTS_AND_MODAL = '''  <!-- ═══════════════════════════════════════════════
       JAVASCRIPT MODULES
       ════════════════════════════════════════════════ -->
  <script src="/static/js/api.js"></script>
  <script src="/static/js/animations.js"></script>
  <script src="/static/js/components.js"></script>
  <script src="/static/js/dashboard.js"></script>
  <script src="/static/js/app.js"></script>

  <!-- Leaflet.js (OpenStreetMap) + Location Picker -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script src="/static/js/location-picker.js"></script>

  <!-- ═══════════════════════════════════════════════
       LOCATION PICKER MODAL (100% free, no API key)
       ════════════════════════════════════════════════ -->
  <div id="lp-modal-overlay" class="lp-modal-overlay" style="display:none;">
    <div class="lp-modal">

      <!-- Header -->
      <div class="lp-hdr">
        <div class="lp-hdr-left">
          <div class="lp-hdr-pin">📍</div>
          <div>
            <div class="lp-hdr-title">Find Your Restaurant</div>
            <div class="lp-hdr-sub">Search, use GPS, or click the map to pin your location</div>
          </div>
        </div>
        <button class="lp-hdr-close" onclick="LocationPicker.close()">✕</button>
      </div>

      <!-- Search + GPS row — dropdown INSIDE this div for correct absolute positioning -->
      <div class="lp-search-section" id="lp-search-section">
        <div class="lp-search-row">
          <span class="lp-srch-icon">🔍</span>
          <input type="text" id="lp-search-input" class="lp-srch-input"
            placeholder="Search address, area, city, landmark..." autocomplete="off"/>
          <button class="lp-gps-pill" onclick="LocationPicker.useMyLocation()">
            <span class="lp-gps-dot"></span>
            🛰️ GPS
          </button>
        </div>
        <div class="lp-dropdown" id="lp-dropdown" style="display:none;"></div>
      </div>

      <!-- GPS loading bar -->
      <div class="lp-gps-bar" id="lp-gps-bar" style="display:none;">
        <div class="lp-gps-bar-inner"></div>
        <span>🛰️ Detecting your GPS location...</span>
      </div>

      <!-- MAP — inline height is KEY; flex-based height caused the blank map bug -->
      <div class="lp-map-shell">
        <div id="lp-map" style="height:360px;width:100%;"></div>
      </div>

      <!-- Emoji Marker Selector -->
      <div class="lp-emoji-row">
        <span class="lp-emoji-label">Your restaurant icon:</span>
        <div class="lp-emoji-list" id="lp-emoji-list">
          <button class="lp-emoji-btn active" onclick="LocationPicker.selectEmoji(this,'🍽️')">🍽️</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'☕')">☕</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'🍕')">🍕</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'🍔')">🍔</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'🍜')">🍜</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'🥗')">🥗</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'🍣')">🍣</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'🌮')">🌮</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'🍰')">🍰</button>
          <button class="lp-emoji-btn" onclick="LocationPicker.selectEmoji(this,'🥐')">🥐</button>
        </div>
      </div>

      <!-- Discovery Card — animates in after location confirmed -->
      <div class="lp-found" id="lp-found" style="display:none;">
        <div class="lp-found-emoji" id="lp-found-emoji">🍽️</div>
        <div class="lp-found-body">
          <div class="lp-found-title">🎉 Perfect! Your restaurant location is confirmed.</div>
          <div class="lp-found-addr" id="lp-found-addr"></div>
          <div class="lp-found-chips" id="lp-found-chips"></div>
        </div>
      </div>

      <!-- Footer -->
      <div class="lp-footer">
        <div class="lp-footer-status" id="lp-footer-status">
          📌 Click the map, search, or use GPS to set your location
        </div>
        <div class="lp-footer-actions">
          <button class="btn btn-glass" onclick="LocationPicker.close()">Cancel</button>
          <button class="btn btn-gold" id="lp-confirm-btn" onclick="LocationPicker.confirmLocation()" disabled>
            ✅ Confirm Location
          </button>
        </div>
      </div>

    </div>
  </div>

</body>
</html>'''

content = content.replace(OLD_SCRIPTS_AND_MODAL, NEW_SCRIPTS_AND_MODAL)

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open('templates/index.html', 'r', encoding='utf-8') as f:
    v = f.read()

checks = [
    ('leaflet.css in head', 'leaflet.css" crossorigin' in v),
    ('leaflet.js script', 'leaflet.js" crossorigin' in v),
    ('location-picker.js', 'location-picker.js' in v),
    ('lp-gps-hero-btn', 'lp-gps-hero-btn' in v),
    ('lp-mini-map-box', 'lp-mini-map-box' in v),
    ('lp-hdr modal', 'class="lp-hdr"' in v),
    ('lp-search-section', 'lp-search-section' in v),
    ('lp-dropdown inside', 'id="lp-dropdown"' in v),
    ('map inline height 360', 'height:360px' in v),
    ('lp-found discovery', 'id="lp-found"' in v),
    ('no OLD modal header', 'lp-modal-header' not in v),
]

print('=== HTML Patch Verification ===')
for name, ok in checks:
    print(f'  {"OK" if ok else "FAIL"}: {name}')
