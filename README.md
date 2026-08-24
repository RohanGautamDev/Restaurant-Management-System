# DineMind AI 🍽️

> **Smart Restaurant Operations, Simplified.**
> A production-quality, full-stack Restaurant Management System powered by **Node.js, Express, SQLite, and Vanilla JavaScript**.

---

## 🌟 Features Overview

### Core Restaurant Operations
- **POS & Order Management**: Atomic order pipeline with live kitchen status updates (`Pending`, `Preparing`, `Ready`, `Completed`, `Cancelled`).
- **Automated Inventory Sync**: Every placed order verifies recipe ingredients in real-time and deducts stock inside an ACID transaction to prevent stockouts and negative quantities.
- **Dynamic Menu Availability**: Menu items automatically switch to `Out of Stock` whenever required ingredient reserves drop below thresholds.
- **Interactive Table Floorplan**: Visual dining floorplan with seating state tags (`Available`, `Occupied`, `Reserved`).
- **Smart Table Recommendation Engine**: Greedily calculates the tightest capacity fit for any party size to optimize turnover.
- **Conflict-Checked Reservations**: Scheduled guest bookings with table assignments and collision prevention.
- **Food Waste & Sustainability Tracking**: Logs waste incidents across reasons (spoilage, prep defect, quality) and computes real-time financial loss metrics.
- **Operations Analytics**: 14-day revenue trends, peak-hour rush distribution (10h–23h), and top 10 dishes ranking.

### Frontend & Motion UI
- **Dark Luxury Glassmorphism**: High-contrast, accessibility-compliant dark theme with smooth glass cards.
- **the-edge.studio Chromatic Pinwheel**: Swirling 6-color vortex iris with velocity spin acceleration and click shockwaves.
- **Fluid Particle Mesh Canvas**: Interactive node network with velocity dispersion physics.
- **3D Perspective Card Tilt**: Real-time holographic perspective with dynamic spotlight shader tracking.
- **Keyboard Menu Keys**: Press keys `1` to `8` to switch sections instantly.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js v22+
- **Backend Framework**: Express.js
- **Database**: SQLite (`better-sqlite3`) with WAL mode & ACID transactions
- **Frontend**: Vanilla JavaScript (Fetch API), HTML5, CSS3 Glassmorphism
- **Motion Engine**: HTML5 Canvas 2D + SVG Chromatic Pinwheel

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.0 or higher)
- **npm** (v9.0 or higher)

### 2. Install Dependencies
```powershell
npm install
```

### 3. Seed Sample Database
Populates 17 menu dishes, 31 inventory ingredients, 15 tables, 210+ orders, 10 reservations, and waste logs:
```powershell
npm run seed
```

### 4. Start the Server
```powershell
npm start
```
*Or for hot-reload development mode:*
```powershell
npm run dev
```

### 5. Open in Browser
👉 **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

---

## 📁 Project Directory Structure

```text
Restaurant Management System/
├── package.json              # Node.js configuration, dependencies & scripts
├── server.js                 # Express server & static file serving
├── dinemind.db               # SQLite database (auto-generated)
│
├── db/                       # Database Layer
│   ├── database.js           # SQLite connection, schema init (8 models) & sync
│   └── seed.js               # Database population script
│
├── routes/                   # REST API Route Handlers
│   ├── dashboard.js          # /api/dashboard/stats/
│   ├── menu.js               # /api/menu/ (CRUD & sync-all)
│   ├── orders.js             # /api/orders/ (Atomic transaction processing)
│   ├── tables.js             # /api/tables/ & /api/tables/recommend/
│   ├── reservations.js       # /api/reservations/ (Booking & conflict checks)
│   ├── inventory.js          # /api/inventory/ & /api/inventory/low-stock/
│   ├── waste.js              # /api/waste/ & /api/waste/summary/
│   └── reports.js            # /api/reports/ (daily sales, peak hours, popular)
│
├── templates/                # HTML Templates
│   └── index.html            # Master SPA Dashboard
│
├── static/                   # Static Frontend Assets
│   ├── css/
│   │   ├── base.css          # Design tokens & typography
│   │   ├── animations.css    # the-edge.studio pinwheel & fluid motion
│   │   ├── components.css    # Glass cards, buttons, badges & modals
│   │   ├── dashboard.css     # Layout, sidebar & topbar styles
│   │   └── responsive.css    # Breakpoints & drawer navigation
│   └── js/
│       ├── api.js            # REST API client
│       ├── animations.js     # Fluid canvas, 3D card tilt & pinwheel physics
│       ├── components.js     # Modals, toasts & real-time clock
│       ├── dashboard.js      # KPI metrics, AI insights & sales charts
│       └── app.js            # SPA routing, menu keys & live CRUD actions
│
└── .vscode/                  # VS Code Integration
    ├── launch.json           # 1-Click Run & Debug configuration (F5)
    └── settings.json         # Workspace formatting settings
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats/` | Live revenue, active orders, table counts & low-stock alerts |
| `GET` | `/api/menu/` | List all menu dishes (filter: `?category=...`, `?available=true`) |
| `POST` | `/api/menu/` | Create new menu item with price and category |
| `PATCH` | `/api/menu/:id/` | Update dish details |
| `DELETE` | `/api/menu/:id/` | Remove dish from catalog |
| `POST` | `/api/menu/sync-all/` | Trigger catalog-wide availability recalculation |
| `GET` | `/api/orders/` | List orders (filter: `?status=pending,preparing,ready,completed`) |
| `POST` | `/api/orders/` | **Atomic Order Placement** with recipe stock deduction |
| `PATCH` | `/api/orders/:id/` | Advance order lifecycle status |
| `GET` | `/api/tables/` | List dining tables with capacity and location |
| `GET` | `/api/tables/recommend/?guests=N` | Smart table recommendation algorithm |
| `GET` | `/api/tables/availability-summary/` | Summary of available, occupied, and reserved tables |
| `GET` | `/api/reservations/` | List upcoming and historical bookings |
| `POST` | `/api/reservations/` | Create reservation & reserve table |
| `PATCH` | `/api/reservations/:id/` | Cancel or complete reservation |
| `GET` | `/api/inventory/` | List 31 ingredient stock reserves |
| `PATCH` | `/api/inventory/:id/` | Restock ingredient quantity |
| `GET` | `/api/inventory/low-stock/` | Report of all items below safety threshold |
| `GET` | `/api/waste/` | List food waste incidents |
| `POST` | `/api/waste/` | Log food waste incident & decrement inventory |
| `GET` | `/api/waste/summary/` | Cumulative and 7-day financial loss metrics |
| `GET` | `/api/reports/daily-sales/?days=7` | Daily revenue and order volume trends |
| `GET` | `/api/reports/peak-hours/?days=14` | Hourly customer traffic distribution |
| `GET` | `/api/reports/popular-items/?limit=10`| Top ordered dishes ranking |
