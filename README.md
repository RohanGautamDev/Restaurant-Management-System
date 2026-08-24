# DineMind AI 🍽

> **Smart Restaurant Operations, Simplified.**
> A complete, production-quality full-stack Restaurant Management System built for the **CodeAlpha Backend Development Internship**.

---

## Features

### Mandatory (CodeAlpha Requirements)
| Feature | Status |
|---|---|
| Django + Django REST Framework backend | ✅ |
| Menu item management (CRUD) | ✅ |
| Order management with status workflow | ✅ |
| Table management | ✅ |
| Reservation system with conflict prevention | ✅ |
| Inventory management | ✅ |
| Auto-deduct inventory on successful orders | ✅ |
| Prevent orders when inventory insufficient | ✅ |
| Daily sales report | ✅ |
| Low-stock alerts | ✅ |
| Popular menu items report | ✅ |
| Django Admin panel | ✅ |

### Smart Features (Unique)
| Feature | Description |
|---|---|
| Smart Table Recommendation | AI suggests best available table based on guest count |
| Dynamic Menu Availability | Items auto-marked out-of-stock when ingredients run low |
| Low Stock Intelligence | Prominent visual alerts when inventory hits threshold |
| Peak Hour Analytics | Identifies busiest hours from order timestamps |
| Food Waste Tracking | Log wasted inventory with cost analytics |
| Real-Time Dashboard | Animated KPI cards with live stats |

---

## Tech Stack

### Backend
- Python 3.13
- Django 5/6
- Django REST Framework 3.x
- SQLite

### Frontend
- HTML5, CSS3, Vanilla JavaScript
- Fetch API (no external JS frameworks)
- Glassmorphism dark luxury UI
- CSS keyframe animations + mouse parallax

---

## Project Structure

```
DineMind-AI/
├── manage.py
├── requirements.txt
├── db.sqlite3
│
├── config/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
│
├── restaurant/
│   ├── __init__.py
│   ├── apps.py
│   ├── models.py          # All 8 database models
│   ├── serializers.py     # DRF serializers with validation
│   ├── views.py           # All viewsets + analytics
│   ├── urls.py            # REST API routing
│   ├── admin.py           # Custom admin panel
│   └── management/
│       └── commands/
│           └── seed_db.py # Sample data seeder
│
├── templates/
│   └── index.html         # Full SPA frontend
│
└── static/
    ├── css/
    │   └── styles.css     # Dark luxury design system
    └── js/
        └── app.js         # Frontend application
```

---

## Installation & Setup

### Prerequisites
- Python 3.10+
- pip

### 1. Clone / Open the Project
```powershell
cd "Restaurant Management System"
```

### 2. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 3. Run Migrations
```powershell
python manage.py migrate
```

### 4. Seed Sample Data
```powershell
python manage.py seed_db
```
This creates:
- Admin user: `admin` / `admin123`
- 31 inventory items
- 17 menu items with ingredients
- 15 tables across Indoor, Outdoor, Private, Bar, Window locations
- 5 upcoming reservations
- 14 days of realistic order history (187+ orders)
- 6 food waste log entries

### 5. Start the Server
```powershell
python manage.py runserver
```

### 6. Open in Browser
- **Dashboard**: http://127.0.0.1:8000/
- **Django Admin**: http://127.0.0.1:8000/admin/ (admin / admin123)

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/menu/` | List / Create menu items |
| GET/PUT/PATCH/DELETE | `/api/menu/{id}/` | Menu item detail |
| POST | `/api/menu/sync-all/` | Sync all menu availability |
| GET/POST | `/api/tables/` | List / Create tables |
| GET | `/api/tables/recommend/?guests=N` | Smart table recommendation |
| GET | `/api/tables/availability-summary/` | Table status summary |
| GET/POST | `/api/orders/` | List / Create orders |
| PATCH | `/api/orders/{id}/` | Update order status |
| GET/POST | `/api/reservations/` | List / Create reservations |
| GET/POST | `/api/inventory/` | List / Create inventory items |
| PATCH | `/api/inventory/{id}/` | Update stock |
| GET | `/api/inventory/low-stock/` | Low stock items |
| GET/POST | `/api/waste/` | Log food waste |
| GET | `/api/waste/summary/` | Waste analytics |
| GET | `/api/dashboard/stats/` | Real-time dashboard KPIs |
| GET | `/api/reports/daily-sales/` | Daily sales breakdown |
| GET | `/api/reports/peak-hours/` | Peak hours analysis |
| GET | `/api/reports/popular-items/` | Most ordered dishes |
| GET | `/api/reports/low-stock/` | Low stock report |

---

## Order Processing Flow

```
1. User selects table + menu items in frontend
2. POST /api/orders/ with table_id + items[]
3. System validates table is available (not occupied/maintenance)
4. System checks all required ingredients across ALL items
5. If any ingredient is insufficient → 400 error, nothing saved
6. If all OK (inside @transaction.atomic):
   a. Create Order record
   b. Create OrderItem records
   c. Deduct inventory for each ingredient
   d. Mark table as 'occupied'
   e. Sync menu item availability
7. Return 201 with full order data
```

---

## Admin Panel Features
- **Inventory**: Stock level badges (In Stock / Low Stock / Out of Stock)
- **Menu Items**: Availability badges, bulk sync action
- **Orders**: Status badges, bulk status updates, inline order items
- **Reservations**: Date hierarchy, status management
- **Food Waste**: Cost tracking, reason filtering

---

## Design System
- **Theme**: Dark luxury glassmorphism
- **Primary Font**: Outfit (Google Fonts)
- **Display Font**: Playfair Display
- **Animation**: CSS keyframes + JS parallax (respects `prefers-reduced-motion`)
- **Background**: Floating gradient orbs + grid overlay + particles
- **Cards**: Glassmorphism with soft glow borders
- **Colors**: Custom dark palette with gold, blue, purple, teal accents

---

## Author

Built for **CodeAlpha Backend Development Internship** as a portfolio-quality demonstration project.
