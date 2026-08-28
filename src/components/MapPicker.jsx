import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MapPicker.css';

/**
 * DineMind AI — Mappls (MapmyIndia) MapPicker Component
 *
 * Reusable React location picker using the official Mappls Web SDK v3.0+.
 * Features:
 *  - Dynamic script loading with VITE_MAPPLS_API_KEY
 *  - Geolocation (Current location detection)
 *  - Search autocomplete
 *  - Map click & draggable pin placement
 *  - Reverse geocoding auto-filling address, latitude, and longitude
 */
const MapPicker = ({
  onLocationSelect,
  initialLocation = { lat: 28.6139, lng: 77.2090 }, // Default: New Delhi / India
  height = '380px',
  className = '',
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Read API Key strictly from environment variable
  const mapplsApiKey = import.meta.env.VITE_MAPPLS_API_KEY;

  const [isLoadingSdk, setIsLoadingSdk] = useState(true);
  const [sdkError, setSdkError] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(initialLocation);
  const [selectedAddress, setSelectedAddress] = useState('Click map or search location...');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  // ── 1. Reverse Geocoding Helper ──────────────────────────────────────────
  const performReverseGeocode = useCallback(
    async (lat, lng) => {
      try {
        if (window.Mappls && typeof window.Mappls.pinCode === 'function') {
          window.Mappls.pinCode({ lat, lng }, (data) => {
            if (data && data.data && data.data.length > 0) {
              const res = data.data[0];
              const addr = res.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
              setSelectedAddress(addr);
              if (onLocationSelect) {
                onLocationSelect({
                  address: addr,
                  lat,
                  lng,
                  city: res.city || res.district || '',
                  state: res.state || '',
                  pincode: res.pincode || '',
                });
              }
            }
          });
          return;
        }

        // Fallback using standard reverse geocode endpoint if SDK plugin is unavailable
        const fallbackRes = await fetch(
          `https://apis.mappls.com/advancedmaps/v1/${mapplsApiKey}/rev_geocode?lat=${lat}&lng=${lng}`
        );
        if (fallbackRes.ok) {
          const resData = await fallbackRes.json();
          if (resData?.results?.[0]) {
            const item = resData.results[0];
            const addr = item.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setSelectedAddress(addr);
            if (onLocationSelect) {
              onLocationSelect({
                address: addr,
                lat,
                lng,
                city: item.city || '',
                state: item.state || '',
                pincode: item.pincode || '',
              });
            }
            return;
          }
        }

        // Default coordinate label
        const defaultAddr = `Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setSelectedAddress(defaultAddr);
        if (onLocationSelect) {
          onLocationSelect({ address: defaultAddr, lat, lng });
        }
      } catch (err) {
        const coordAddr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setSelectedAddress(coordAddr);
        if (onLocationSelect) {
          onLocationSelect({ address: coordAddr, lat, lng });
        }
      }
    },
    [mapplsApiKey, onLocationSelect]
  );

  // ── 2. Update Marker Position ────────────────────────────────────────────
  const setMarkerPosition = useCallback(
    (lat, lng, shouldReverseGeocode = true) => {
      setCurrentCoords({ lat, lng });

      if (!mapInstanceRef.current || !window.Mappls) return;

      if (!markerInstanceRef.current) {
        // Create new draggable marker
        markerInstanceRef.current = new window.Mappls.Marker({
          map: mapInstanceRef.current,
          position: { lat, lng },
          fitbounds: false,
          draggable: true,
        });

        // Add dragend listener to update coordinates & address
        if (markerInstanceRef.current.addListener) {
          markerInstanceRef.current.addListener('dragend', (e) => {
            let newLat = lat;
            let newLng = lng;
            if (e && e.target && typeof e.target.getPosition === 'function') {
              const pos = e.target.getPosition();
              newLat = pos.lat;
              newLng = pos.lng;
            } else if (markerInstanceRef.current.getPosition) {
              const pos = markerInstanceRef.current.getPosition();
              newLat = pos.lat;
              newLng = pos.lng;
            }
            setCurrentCoords({ lat: newLat, lng: newLng });
            performReverseGeocode(newLat, newLng);
          });
        }
      } else {
        // Move existing marker
        if (markerInstanceRef.current.setPosition) {
          markerInstanceRef.current.setPosition({ lat, lng });
        }
      }

      // Center map smoothly on the coordinates
      if (mapInstanceRef.current.setCenter) {
        mapInstanceRef.current.setCenter({ lat, lng });
      }

      if (shouldReverseGeocode) {
        performReverseGeocode(lat, lng);
      }
    },
    [performReverseGeocode]
  );

  // ── 3. Load Mappls SDK Dynamically ───────────────────────────────────────
  useEffect(() => {
    if (!mapplsApiKey || mapplsApiKey === 'YOUR_STATIC_KEY') {
      setSdkError('Mappls API key is missing or not configured in .env (VITE_MAPPLS_API_KEY).');
      setIsLoadingSdk(false);
      return;
    }

    // Check if SDK already loaded on window
    if (window.Mappls && window.Mappls.Map) {
      setIsLoadingSdk(false);
      return;
    }

    const scriptId = 'mappls-sdk-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://apis.mappls.com/advancedmaps/api/${mapplsApiKey}/map_sdk?layer=vector&v=3.0&libraries=search,geocode`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setIsLoadingSdk(false);
      };

      script.onerror = () => {
        setSdkError('Failed to load Mappls Web SDK. Please check your internet connection or API Key.');
        setIsLoadingSdk(false);
      };

      document.head.appendChild(script);
    } else {
      setIsLoadingSdk(false);
    }
  }, [mapplsApiKey]);

  // ── 4. Initialize Map Instance ───────────────────────────────────────────
  useEffect(() => {
    if (isLoadingSdk || sdkError || !window.Mappls || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      const map = new window.Mappls.Map(mapContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom: 15,
        zoomControl: true,
        hybrid: false,
        location: true,
      });

      mapInstanceRef.current = map;

      // Handle map click to place/move marker
      map.addListener('click', (e) => {
        if (e && e.lngLat) {
          setMarkerPosition(e.lngLat.lat, e.lngLat.lng, true);
        }
      });

      // Initial marker placement
      map.on('load', () => {
        setMarkerPosition(currentCoords.lat, currentCoords.lng, true);
      });
    } catch (err) {
      console.error('Error initializing Mappls Map:', err);
      setSdkError('Unable to initialize Mappls Map canvas.');
    }

    return () => {
      if (mapInstanceRef.current && typeof mapInstanceRef.current.remove === 'function') {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, [isLoadingSdk, sdkError, currentCoords.lat, currentCoords.lng, setMarkerPosition]);

  // ── 5. Detect User's Current Location (GPS) ──────────────────────────────
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingGps(false);
        const { latitude, longitude } = position.coords;
        setMarkerPosition(latitude, longitude, true);
      },
      (error) => {
        setIsDetectingGps(false);
        let errorMsg = 'Could not detect location. Please check browser permissions.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. Please allow location access in browser.';
        }
        alert(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [setMarkerPosition]);

  // ── 6. Address Search / Autocomplete ─────────────────────────────────────
  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (window.Mappls && typeof window.Mappls.search === 'function') {
          window.Mappls.search(value, { location: [currentCoords.lat, currentCoords.lng] }, (data) => {
            setIsSearching(false);
            if (data && data.data) {
              setSuggestions(data.data);
            }
          });
          return;
        }

        // REST AutoSuggest Fallback
        const res = await fetch(
          `https://atlas.mappls.com/api/places/search/json?query=${encodeURIComponent(value)}&access_token=${mapplsApiKey}`
        );
        const data = await res.json();
        setIsSearching(false);
        if (data && data.suggestedLocations) {
          setSuggestions(data.suggestedLocations);
        }
      } catch (err) {
        setIsSearching(false);
        setSuggestions([]);
      }
    }, 450);
  };

  const handleSelectSuggestion = (item) => {
    setSuggestions([]);
    const placeName = item.placeName || item.placeAddress || item.eLoc || '';
    setSearchQuery(placeName);

    const lat = parseFloat(item.latitude || item.lat);
    const lng = parseFloat(item.longitude || item.lng || item.lon);

    if (!isNaN(lat) && !isNaN(lng)) {
      setMarkerPosition(lat, lng, true);
    }
  };

  return (
    <div className={`mappls-picker-container ${className}`}>
      {/* Search and GPS controls */}
      <div className="mappls-controls-row">
        <div className="mappls-search-box">
          <span className="mappls-search-icon">🔍</span>
          <input
            type="text"
            className="mappls-search-input"
            placeholder="Search address, landmark, or area..."
            value={searchQuery}
            onChange={handleSearchInput}
          />
          {suggestions.length > 0 && (
            <div className="mappls-suggestions-dropdown">
              {suggestions.map((item, index) => (
                <div
                  key={item.eLoc || index}
                  className="mappls-suggestion-item"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <span>📍</span>
                  <div>
                    <strong>{item.placeName || item.formatted_address || 'Location'}</strong>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {item.placeAddress || item.address || ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="mappls-gps-btn"
          onClick={handleUseCurrentLocation}
          disabled={isDetectingGps}
        >
          <span>{isDetectingGps ? '⏳' : '📍'}</span>
          <span>{isDetectingGps ? 'Locating...' : 'Use Current Location'}</span>
        </button>
      </div>

      {/* Map Canvas Shell */}
      <div className="mappls-map-wrapper" style={{ height }}>
        {isLoadingSdk && (
          <div className="mappls-overlay-state">
            <div className="mappls-spinner"></div>
            <span>Loading Mappls Maps SDK...</span>
          </div>
        )}

        {sdkError && (
          <div className="mappls-overlay-state">
            <div className="mappls-error-badge">⚠️ {sdkError}</div>
          </div>
        )}

        <div ref={mapContainerRef} className="mappls-map-canvas" />
      </div>

      {/* Selected Location Summary */}
      <div className="mappls-info-bar">
        <div className="mappls-info-address" title={selectedAddress}>
          <span>📌</span>
          <span>{selectedAddress}</span>
        </div>
        <div className="mappls-info-coords">
          {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
        </div>
      </div>
    </div>
  );
};

export default MapPicker;
