# 🍽️ DineMind AI — Project Architecture & Core Concept

DineMind AI is a smart, full-stack restaurant operations platform featuring automated inventory controls, role-based consoles, and a free, interactive geocoding location picker designed for onboarding new restaurant owners.

---

## 🏗️ 1. Technical Stack & Architecture

- **Frontend**: Lightweight Single Page Application (SPA) built using HTML5, JavaScript Modules, and Vanilla CSS with a modern Glassmorphism theme.
- **Backend**: Node.js & Express REST API managing authentication, operations, roles, and inventory.
- **Database**: SQLite (`better-sqlite3`) pre-seeded with floor plans, tables, menu categories, and user accounts.

---

## 💾 2. Serverless SQLite Database Strategy

Because host platforms like Vercel have a read-only root directory, file-based databases typically crash on write operations. DineMind AI bypasses this limitation using a **two-step boot seeding pattern**:
1. At server start, the database handler checks if it is running in a serverless environment (`process.env.VERCEL`).
2. If true, the system dynamically duplicates the database file (`dinemind.db`) from the read-only root into the writable `/tmp/dinemind.db` virtual path.
3. All write/read operations are routed to `/tmp/`, ensuring data persistence and read-write operations in a serverless environment.

---

## 🗺️ 3. Free Dual-Layer Location Picker Component

To eliminate maps API fees, the signup page features an interactive location picker combining **Leaflet.js**, **OpenStreetMap (OSM)**, and the **Nominatim Geocoding API**.

- **Street & Satellite view layers**: Allows users to toggle between standard street vector map tiles (OSM) and high-resolution satellite imagery tiles (Esri World Imagery) with a floating glassmorphism layer control button.
- **Interactive Emoji Pins**: Users can choose their business category icon (🍽️, ☕, 🍕, 🍔, etc.) and drop or drag the pin. The emoji marker dynamically counter-rotates via CSS (`transform: rotate(45deg);` counteracting the pin rotation) to display centered and upright.
- **Form Interception**: Prevents default page submit when users press the `Enter` key inside the search bar, running geocoding queries instead.
- **Secure Event Delegation**: Click listeners are set on the dropdown parent element using `data-index` attributes corresponding to a clean memory array of results. This completely avoids JavaScript syntax crashes when dealing with address names containing quotes (e.g. *O'Connor's*).
- **Client Policy Identification**: Autocomplete requests include Nominatim policy parameters (`&email=dinemind-ai@restaurant.com`) to prevent rate limits or service blocks.

---

## ⚡ 4. Mobile Performance Optimization

- **Hardware Acceleration**: Replaces CPU-bound JavaScript animations on mobile viewports (`<= 768px`) with GPU-accelerated CSS keyframe animations.
- **Backdrop-Filter Bypass**: Disables resource-intensive parallax orbs (`.orb`) and heavy glassmorphism blurs on touch screen viewports to ensure smooth 60fps scrolling.
- **Fluid Layout Grids**: Grid columns dynamically collapse from multi-column configurations to single-column blocks to keep content readable.
