"""
Replace all location picker CSS in components.css from line 725 to end
with clean, working styles.
"""

with open('static/css/components.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the location picker section and remove everything after it
LP_START = '/* ═══════════════════════════════════════════════════════════════\n   LOCATION PICKER — Full feature set\n   ═══════════════════════════════════════════════════════════════ */'

LP_START_IDX = content.find(LP_START)
if LP_START_IDX == -1:
    print('ERROR: Could not find LP section start')
    exit(1)

# Everything before the LP section
base = content[:LP_START_IDX]

NEW_LP_CSS = '''/* ═══════════════════════════════════════════════════════════════
   LOCATION PICKER — OpenStreetMap + Leaflet.js (100% free)
   ═══════════════════════════════════════════════════════════════ */

/* ─── GPS Hero Button (signup form) ─── */
.lp-gps-hero-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(79,142,255,0.12), rgba(157,111,255,0.1));
  border: 1.5px solid rgba(79,142,255,0.4);
  border-radius: var(--r-md);
  color: #a0c4ff;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.25s;
  margin-bottom: 8px;
  font-family: inherit;
}

.lp-gps-hero-btn:hover:not(:disabled) {
  border-color: rgba(79,142,255,0.8);
  background: linear-gradient(135deg, rgba(79,142,255,0.2), rgba(157,111,255,0.15));
  color: #c0d8ff;
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(79,142,255,0.2);
}

.lp-gps-hero-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.lp-gps-pulse-ring {
  width: 12px;
  height: 12px;
  background: #7eb8ff;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
}

.lp-gps-pulse-ring::before {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px solid rgba(79,142,255,0.6);
  border-radius: 50%;
  animation: lpPulseRing 1.5s ease-out infinite;
}

@keyframes lpPulseRing {
  0%   { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.8); opacity: 0; }
}

/* ─── Map Trigger (secondary button) ─── */
.lp-map-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: rgba(255,255,255,0.03);
  border: 1px dashed rgba(255,255,255,0.12);
  border-radius: var(--r-md);
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text-3);
  transition: all 0.2s;
  margin-bottom: 10px;
}

.lp-map-trigger:hover {
  border-color: rgba(245,200,66,0.4);
  color: var(--text-2);
  background: rgba(245,200,66,0.04);
}

/* ─── Signup Form Location Preview ─── */
.lp-signup-preview {
  border-radius: var(--r-md);
  overflow: hidden;
  border: 1px solid rgba(62,207,142,0.3);
  background: rgba(62,207,142,0.04);
  animation: lpPreviewIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
}

@keyframes lpPreviewIn {
  from { opacity: 0; transform: scale(0.97) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.lp-mini-map-box {
  height: 100px;
  width: 100%;
  background: #0a0e1e;
}

.lp-signup-preview-body {
  padding: 10px 14px 12px;
}

.lp-signup-preview-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.lp-signup-preview-emoji {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.lp-signup-preview-addr {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-signup-preview-coords {
  font-size: 0.66rem;
  color: var(--text-3);
  font-family: 'JetBrains Mono', monospace;
  margin-top: 2px;
}

.lp-signup-preview-edit {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xs);
  padding: 4px 8px;
  font-size: 0.75rem;
  cursor: pointer;
  color: var(--text-2);
  flex-shrink: 0;
  transition: all 0.18s;
  font-family: inherit;
}

.lp-signup-preview-edit:hover {
  background: rgba(245,200,66,0.12);
  border-color: var(--gold);
  color: var(--gold);
}

.lp-signup-preview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.lp-signup-preview-success {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--green);
  text-align: center;
  padding: 4px;
  background: rgba(62,207,142,0.08);
  border-radius: var(--r-xs);
}

/* ─── Modal Overlay ─── */
.lp-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 19999;
  background: rgba(4,7,17,0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

/* ─── Modal Box ─── */
.lp-modal {
  width: 100%;
  max-width: 900px;
  max-height: calc(100vh - 32px);
  background: rgba(10,14,30,0.98);
  border: 1px solid rgba(79,142,255,0.2);
  border-radius: 20px;
  box-shadow: 0 40px 100px rgba(0,0,0,0.85), 0 0 80px rgba(79,142,255,0.06);
  overflow-y: auto;
  overflow-x: hidden;
  animation: lpModalIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both;
}

@keyframes lpModalIn {
  from { opacity: 0; transform: translateY(28px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ─── Header ─── */
.lp-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(79,142,255,0.1);
  background: linear-gradient(135deg, rgba(79,142,255,0.05), rgba(157,111,255,0.04));
  position: sticky;
  top: 0;
  z-index: 10;
}

.lp-hdr-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.lp-hdr-pin {
  font-size: 2rem;
  animation: lpBob 2.2s ease-in-out infinite;
}

@keyframes lpBob {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}

.lp-hdr-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-1);
}

.lp-hdr-sub {
  font-size: 0.75rem;
  color: var(--text-3);
  margin-top: 2px;
}

.lp-hdr-close {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-2);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.18s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lp-hdr-close:hover {
  background: rgba(255,92,138,0.18);
  border-color: rgba(255,92,138,0.5);
  color: #fff;
}

/* ─── Search Section ─── */
.lp-search-section {
  position: relative;   /* ← suggestions dropdown positions relative to this */
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.015);
}

.lp-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lp-srch-icon {
  font-size: 1rem;
  color: var(--text-3);
  flex-shrink: 0;
}

.lp-srch-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-1);
  font-size: 0.9rem;
  font-family: inherit;
  min-width: 0;
}

.lp-srch-input::placeholder { color: var(--text-3); }

.lp-gps-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: linear-gradient(135deg, rgba(79,142,255,0.15), rgba(157,111,255,0.12));
  border: 1px solid rgba(79,142,255,0.4);
  border-radius: var(--r-full);
  color: #7eb8ff;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
  font-family: inherit;
}

.lp-gps-pill:hover {
  border-color: rgba(79,142,255,0.75);
  background: linear-gradient(135deg, rgba(79,142,255,0.25), rgba(157,111,255,0.2));
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(79,142,255,0.22);
}

.lp-gps-dot {
  width: 8px;
  height: 8px;
  background: #7eb8ff;
  border-radius: 50%;
  flex-shrink: 0;
  animation: lpPulseRing 1.5s ease-out infinite;
}

/* ─── Search Dropdown ─── */
.lp-dropdown {
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  right: 0;
  background: rgba(10,14,30,0.99);
  border: 1px solid rgba(79,142,255,0.25);
  border-top: none;
  border-radius: 0 0 12px 12px;
  max-height: 260px;
  overflow-y: auto;
  z-index: 9999;
  box-shadow: 0 16px 50px rgba(0,0,0,0.7);
}

.lp-dd-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.lp-dd-item:hover { background: rgba(79,142,255,0.1); }
.lp-dd-item:last-child { border-bottom: none; }

.lp-dd-pin {
  font-size: 0.9rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.lp-dd-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.35;
}

.lp-dd-name mark {
  background: rgba(245,200,66,0.28);
  color: var(--gold);
  border-radius: 2px;
  padding: 0 1px;
}

.lp-dd-type {
  font-size: 0.7rem;
  color: var(--text-3);
  margin-top: 2px;
}

.lp-dd-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 0.82rem;
}

/* ─── GPS Loading Bar ─── */
.lp-gps-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  background: rgba(79,142,255,0.06);
  border-bottom: 1px solid rgba(79,142,255,0.12);
  font-size: 0.8rem;
  color: #7eb8ff;
  overflow: hidden;
}

.lp-gps-bar-inner {
  height: 2px;
  background: linear-gradient(90deg, transparent, #7eb8ff, transparent);
  animation: lpBarScan 1.5s linear infinite;
  width: 60px;
  flex-shrink: 0;
}

@keyframes lpBarScan {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

/* ─── Map Shell ─── */
.lp-map-shell {
  /* No height needed here — the #lp-map div has inline height:360px */
  overflow: hidden;
  border-top: 1px solid rgba(255,255,255,0.04);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  position: relative;
}

/* Leaflet tile dark filter */
.lp-map-shell .leaflet-tile {
  filter: brightness(0.88) saturate(0.85);
}

.lp-map-shell .leaflet-control-attribution {
  background: rgba(4,7,17,0.8) !important;
  color: rgba(255,255,255,0.35) !important;
  font-size: 9px !important;
}

.lp-map-shell .leaflet-control-zoom a {
  background: rgba(10,14,30,0.92) !important;
  border-color: rgba(79,142,255,0.35) !important;
  color: #7eb8ff !important;
}

/* ─── Custom Map Pin ─── */
.lp-pin-wrap {
  position: relative;
  width: 52px;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lp-pin-body {
  width: 48px;
  height: 48px;
  background: rgba(10,14,30,0.92);
  border: 2.5px solid rgba(245,200,66,0.8);
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.6), 0 0 24px rgba(245,200,66,0.3);
  animation: lpPinDrop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
}

.lp-pin-body::before {
  content: attr(data-emoji);
  transform: rotate(45deg);
  display: block;
}

/* The emoji is the text node inside .lp-pin-body — rotate it back */
.lp-pin-body {
  line-height: 1;
}

/* Since emoji is inside the rotated div, we counter-rotate using ::after or just use the trick below */
/* The emoji text inside .lp-pin-body is already inside the rotated container.
   The transform on parent rotates everything. Use a wrapper span to counter-rotate. */

@keyframes lpPinDrop {
  0%  { transform: rotate(-45deg) translateY(-30px); opacity: 0; }
  80% { transform: rotate(-45deg) translateY(3px); }
  100%{ transform: rotate(-45deg) translateY(0); opacity: 1; }
}

.lp-pin-shadow {
  width: 12px;
  height: 5px;
  background: rgba(0,0,0,0.35);
  border-radius: 50%;
  margin-top: -4px;
}

/* ─── Emoji Selector Row ─── */
.lp-emoji-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(255,255,255,0.012);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.lp-emoji-label {
  font-size: 0.72rem;
  color: var(--text-3);
  white-space: nowrap;
  flex-shrink: 0;
}

.lp-emoji-list {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.lp-emoji-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
  border: 1.5px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.18s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: 'Apple Color Emoji','Segoe UI Emoji',sans-serif;
}

.lp-emoji-btn:hover {
  border-color: rgba(245,200,66,0.5);
  background: rgba(245,200,66,0.08);
  transform: scale(1.15);
}

.lp-emoji-btn.active {
  border-color: var(--gold);
  background: rgba(245,200,66,0.15);
  box-shadow: 0 0 14px rgba(245,200,66,0.3);
  transform: scale(1.1);
}

/* ─── Discovery "Found" Card ─── */
.lp-found {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(62,207,142,0.07), rgba(79,142,255,0.05));
  border-top: 1px solid rgba(62,207,142,0.22);
  border-bottom: 1px solid rgba(62,207,142,0.12);
}

.lp-found-anim {
  animation: lpFoundSlide 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
}

@keyframes lpFoundSlide {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}

.lp-found-emoji {
  font-size: 2.2rem;
  flex-shrink: 0;
  animation: lpBob 2s ease-in-out infinite;
}

.lp-found-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--green);
  margin-bottom: 4px;
}

.lp-found-addr {
  font-size: 0.76rem;
  color: var(--text-2);
  line-height: 1.4;
  margin-bottom: 6px;
}

.lp-found-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* ─── Shared Chip ─── */
.lp-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--r-full);
  font-size: 0.68rem;
  color: var(--text-2);
  white-space: nowrap;
}

/* ─── Footer ─── */
.lp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.01);
  position: sticky;
  bottom: 0;
}

.lp-footer-status {
  flex: 1;
  font-size: 0.76rem;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-footer-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* ─── Mobile ─── */
@media (max-width: 640px) {
  .lp-modal-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .lp-modal {
    max-width: 100%;
    max-height: 94vh;
    border-radius: 20px 20px 0 0;
    animation: lpModalInMob 0.38s cubic-bezier(0.34,1.56,0.64,1) both;
  }

  @keyframes lpModalInMob {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  #lp-map { height: 240px !important; }

  .lp-gps-pill span:last-child { display: none; }

  .lp-footer {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .lp-footer-actions {
    justify-content: stretch;
  }

  .lp-footer-actions .btn {
    flex: 1;
    justify-content: center;
  }

  .lp-hdr {
    padding: 14px 16px;
  }
}
'''

final = base + NEW_LP_CSS

with open('static/css/components.css', 'w', encoding='utf-8') as f:
    f.write(final)

print(f'Written {len(final)} chars')
print('Contains lp-gps-hero-btn:', '.lp-gps-hero-btn' in final)
print('Contains lp-pin-body:', '.lp-pin-body' in final)
print('Contains lp-found:', '.lp-found ' in final)
print('Contains lp-dropdown:', '.lp-dropdown' in final)
print('Contains lp-modal-overlay:', '.lp-modal-overlay' in final)
