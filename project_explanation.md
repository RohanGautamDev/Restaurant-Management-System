# 🍽️ DineMind AI — Full Page System Architecture & Design Documentation

---

## 📌 Executive Overview

**DineMind AI** is an enterprise-grade AI SaaS restaurant operations platform featuring modern glassmorphism design inspired by **Apple, Linear, Vercel, Framer, and OpenAI**. 

The platform combines role-based operational consoles (Admin, Manager, Staff), a single-session Mappls Web SDK geocoding location picker, pure CSS motion graphics, and a serverless SQLite persistence architecture.

---

## 🎨 1. Two-Column Hero Section Layout Architecture

The landing page features a **55% Left / 45% Right Two-Column Hero Banner** (`.saas-hero-banner`) designed for maximum visual contrast, brand emphasis, and clear call-to-action hierarchy.

```
┌───────────────────────────────────────────────────────────────────┐
│                     2-COLUMN HERO BANNER                         │
├─────────────────────────────────────┬─────────────────────────────┤
│  LEFT COLUMN (55%)                  │  RIGHT COLUMN (45%)         │
│  • Platform Badge                   │  Dedicated Right Side       │
│  • Main Heading (2.5rem Gradient)   │  Large (340px)              │
│  • Subtitle & Description           │  Vertically Centered        │
│  • Feature Badges (Pills)           │  Rotating BBQ Grill Image   │
│  • Primary CTA Button               │  (.bbq-rotate Animation)    │
├─────────────────────────────────────┴─────────────────────────────┤
│            1-CLICK DEMO & LOCATION CARDS BELOW                    │
└───────────────────────────────────────────────────────────────────┘
```

### **A. Left Column Components (55% Width)**
- **Platform Badge**: `✨ DineMind AI Platform` (Glassmorphism rounded badge with `#38ef7d` green accent).
- **Main Heading**: `Simplify & Scale Restaurant Operations` (Large `2.5rem` gradient typography).
- **Description**: `Add your restaurant profile, configure table layouts, and automate POS, kitchen KDS & smart inventory with Mappls geocoding precision.`
- **Feature Badges**: `⚡ Mappls Geocoding`, `📊 Smart POS`, `👨‍🍳 Live Kitchen KDS`, `📦 Auto Inventory`.
- **Primary CTA Button**: `✨ Get Started / Onboard Restaurant` (Smooth scroll link targeting registration form below).

### **B. Right Column Components (45% Width)**
- **Dedicated Right Column**: Contains **ONLY** the large (`340px`), right-aligned, vertically centered rotating BBQ grill image asset (`/static/images/bbq-grill.png`).
- **Independent Placement**: Positioned strictly on the right side next to headline text and CTA, avoiding text overlap or centering above headlines.

### **C. Responsive Stacking Mechanics**
- **Desktop (≥ 860px)**: Wide 2-Column layout (`flex-direction: row; justify-content: space-between; align-items: center;`).
- **Mobile / Tablet (< 860px)**: Stacks vertically:
  1. Text & CTA (`.saas-hero-left`)
  2. Rotating BBQ Grill Image (`.saas-hero-right`)
  3. 1-Click Quick Demo Selectors & Registration Form Cards

---

## 🌀 2. Pure CSS Motion Graphics System (`bbq-rotate`)

The motion graphics system relies on hardware-accelerated CSS keyframe animations, ensuring smooth 60fps performance without JavaScript animation library dependencies (no GSAP, no Framer Motion).

### **A. BBQ Grill Animation Keyframes (`.bbq-rotate`)**
```css
@keyframes slow-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes floating {
  0%   { transform: translateY(0px) rotate(0deg); }
  50%  { transform: translateY(-8px) rotate(180deg); }
  100% { transform: translateY(0px) rotate(360deg); }
}

@keyframes glow {
  0%   { filter: drop-shadow(0 0 12px rgba(255,120,0,.25)); }
  50%  { filter: drop-shadow(0 0 35px rgba(255,120,0,.55)); }
  100% { filter: drop-shadow(0 0 12px rgba(255,120,0,.25)); }
}

.bbq-rotate {
  animation:
    slow-spin 40s linear infinite,
    floating 6s ease-in-out infinite,
    glow 3s ease-in-out infinite;
  transform-origin: center center;
  will-change: transform, filter;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}
```

### **B. Ambient Multi-Layer SaaS Background**
- **Fluid Blur Color Blobs**: 6 floating blurred radial light sources (`.saas-blob-1` through `.saas-blob-6`) using Light Green (`#A8E063`), Soft Coral Red (`#FF7A7A`), and Soft White highlights with slow 26s–36s drift keyframes.
- **Floating Particles**: 6 subtle micro glowing dots drifting softly across the background space.

---

## 📍 3. Single-Session Collapsible Mappls Location Picker

To guarantee compatibility with the official Mappls Web SDK v3 and prevent `"Unable to connect to Mappls Map service"` crashes caused by secondary map canvas initializations, DineMind AI enforces a **Single Map Session Pattern**.

### **A. Accordion Flow Mechanics**
- **Collapsed Preview State (`#saas-hero-collapsed`)**:
  - Displays confirmed restaurant icon (`🍽️`), full formatted address (`#lp-preview-addr`), coordinates (`#lp-preview-coords`), and city/state/country/postcode chips (`#lp-preview-chips`).
  - Action Button: `✏️ Edit Location`.
- **Inline Expansion (`LocationPicker.expand()`)**:
  - Clicking `✏️ Edit Location` smoothly expands the Hero Card accordion in place (300ms cubic-bezier transition).
  - **No Popups, Modals, or Floating Windows**: Preserves inline landing page context.
  - Automatically triggers `map.resize()` to adjust Mappls canvas dimensions smoothly without gray render artifacts.
- **Confirmation (`LocationPicker.confirmLocation()`)**:
  - Saves coordinates and address to hidden form inputs (`signup-lat`, `signup-lng`, `signup-formatted-address`, `signup-city`, `signup-country`, `signup-marker-emoji`).
  - Refreshes preview chips and smoothly collapses the card back to summary mode.

---

## 💾 4. Serverless SQLite Persistence Architecture

Because host environments like Vercel provide a read-only root filesystem, traditional SQLite write operations throw filesystem permission errors. DineMind AI addresses this with a **Two-Step Serverless Boot Pattern**:

1. **Environment Inspection**: Upon server boot (`server.js`), the database handler checks for serverless environment variables (`process.env.VERCEL`).
2. **Dynamic Virtual Copying**: If detected, `dinemind.db` is copied from the read-only project root into the writable `/tmp/dinemind.db` path.
3. **Database Routing**: All read/write operations (restaurant registrations, orders, table updates, inventory tracking) are routed to `/tmp/dinemind.db`.

---

## 📁 5. Complete File Directory Map

| Path | Primary Purpose |
| --- | --- |
| **[`templates/index.html`](file:///c:/Users/vendors/Desktop/Restaurant%20Management%20System/templates/index.html)** | Single-page landing template containing 2-column Hero section, 1-Click demo controls, collapsible location card, and operational dashboards. |
| **[`static/css/components.css`](file:///c:/Users/vendors/Desktop/Restaurant%20Management%20System/static/css/components.css)** | Glassmorphism design tokens, 2-column grid layout rules (`.saas-hero-banner`), accordion transitions, and button styles. |
| **[`static/css/animations.css`](file:///c:/Users/vendors/Desktop/Restaurant%20Management%20System/static/css/animations.css)** | Pure CSS keyframes for `.bbq-rotate`, fluid mesh gradients, and floating background blobs. |
| **[`static/css/responsive.css`](file:///c:/Users/vendors/Desktop/Restaurant%20Management%20System/static/css/responsive.css)** | Responsive layout rules and mobile stacking breakpoints (`@media (max-width: 860px)`). |
| **[`static/js/location-picker.js`](file:///c:/Users/vendors/Desktop/Restaurant%20Management%20System/static/js/location-picker.js)** | Mappls Web SDK v3 single map instance controller, geocoding handlers, and accordion expand/collapse logic. |
| **[`static/images/bbq-grill.png`](file:///c:/Users/vendors/Desktop/Restaurant%20Management%20System/static/images/bbq-grill.png)** | High-resolution BBQ grill image asset rendered in the right column of the Hero Section. |
| **[`server.js`](file:///c:/Users/vendors/Desktop/Restaurant%20Management%20System/server.js)** | Express backend server managing authentication, Mappls reverse-geocode/search API proxies, and SQLite data access. |
