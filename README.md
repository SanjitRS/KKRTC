# 🚍 NITTE Bus Tracker (PWA) - NMIT Bengaluru Campus

A mobile-first Progressive Web App (PWA) that enables **Nitte Meenakshi Institute of Technology (NMIT, Yelahanka, Bengaluru)** students to track their college buses live from their own boarding stop with real-time ETA, route progression, and push alerts.

Incorporates OpenStreetMap (OSM Mapnik tiles), 450m geofence safe zones around student boarding stops, screen wake lock for drivers, and offline GPS queuing inspired by [`SanjitRS/BMTC`](https://github.com/SanjitRS/BMTC).

---

## 🌟 Key Features

### 🎓 1. Student App
- **Sign up / Login**: Authenticate with College Email (`@nmit.ac.in`) or USN (e.g. `1NT21CS001`).
- **Profile Customization**: Boarding stop and bus route saved to the student profile.
- **Live Interactive Map**:
  - OpenStreetMap (OSM Mapnik) with zero API keys required.
  - Animated bus marker with heading rotation and speed telemetry.
  - **450m Geofence Safe Zone**: Circular boundary around your boarding stop with color-coded arrival states (turns emerald green `#10b981` upon bus arrival).
  - Highlighted golden star marker for your personal boarding stop.
- **Real-Time ETA Badge**:
  - Live arrival countdown ("Arriving in 7 min").
  - Distance away (e.g. "3.2 km away") and speed (e.g. "38 km/h").
  - Status indicator: `Not started` • `On the way` • `Arrived` • `Delayed` • `Breakdown` • `Offline`.
- **Direction Toggle**: Switch between **Morning** (Home to NMIT Campus) and **Evening** (NMIT Campus to Home) trips.
- **Full Route Timeline**: Visual stop sequence with crossed stops (green checkmarks), active/approaching stop tag, and scheduled arrival times.
- **Push & Web Notifications**: Web Audio chime and browser push alerts when the bus is **~10 min** and **~2 min** away.
- **Notice Banner**: Real-time broadcast alerts from the NMIT transport office (e.g., Hebbal flyover delays, Kogilu diversions, Anaadyanta fest special buses).
- **Other Routes Explorer**: Instantly switch between routes to track other college buses.

### 🚍 2. Driver App
- **Simple Login**: Select bus (Bus 01 to Bus 05) and trip direction (Morning / Evening).
- **"Start Trip"**: Initiates GPS tracking and broadcasts live telemetry to all subscribed students.
- **Screen Wake Lock**: Uses the Screen Wake Lock API to prevent the mobile screen from locking while driving.
- **Offline Resilience**: Automatically queues GPS updates locally in `localStorage` when driving through weak network patches, and flushes them to the server upon reconnection.
- **Next Stop & ETA**: Displays upcoming stop name, landmark, and ETA.
- **Quick Status Broadcasts**:
  - ⚠️ **Delayed** (weather / roadblocks)
  - 🚗 **Traffic Jam** (heavy congestion)
  - 🛑 **Breakdown** (mechanical fault / puncture)
  - ⏰ **On Schedule** (normal operation)
- **"End Trip"**: Completes trip and sets bus to idle.

### 🛡️ 3. Transport Office (Admin Panel)
- **Live Fleet Overview**: Interactive map displaying all 5 college buses in real-time with speed, driver details, and status across Bengaluru.
- **Route & Stop Management**:
  - Add/edit routes, codes, colors, and start/end locations.
  - **Map Pin Placement**: Click anywhere on the map to drop a pin and automatically capture exact latitude/longitude coordinates to create a stop.
- **Bus & Driver Assignments**: Add buses, assign drivers to buses, and assign buses to routes.
- **Broadcast Announcements**: Send instant announcements to all students or target specific routes.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React
- **PWA**: Installable Web App Manifest (`manifest.json`), Service Worker (`sw.js`) with offline caching
- **Maps**: Leaflet + OpenStreetMap (OSM Mapnik tiles — no API key needed, inspired by `SanjitRS/BMTC`)
- **Backend**: Node.js, Express.js, Socket.IO for real-time WebSockets
- **Database**:
  - **Embedded SQLite (`sql.js` WASM)**: Works 100% out of the box with zero setup required.
  - **PostgreSQL**: Native PostgreSQL support via `pg` connection pool when `DATABASE_URL` is set.
- **Simulator**: Realistic GPS bus fleet movement simulator script.

---

## 🗺️ NMIT Bengaluru Routes & Stops

Campus: **NMIT Yelahanka Campus** (`13.12939° N, 77.58790° E`, Govindapura, Gollahalli, Yelahanka, Bengaluru)

| Route Code | Route Name | Terminus Stops | Total Stops |
|---|---|---|---|
| **R1-MAJ** | Route 1: Majestic (KBS) - Hebbal - NMIT Yelahanka | Kempegowda Bus Station ↔ NMIT Campus | 10 Stops |
| **R2-WTF** | Route 2: Whitefield - KR Puram - Manyata - NMIT Yelahanka | ITPL / Whitefield ↔ NMIT Campus | 9 Stops |
| **R3-VJR** | Route 3: Vijayanagar - Rajajinagar - BEL - NMIT Yelahanka | Vijayanagar TTMC ↔ NMIT Campus | 8 Stops |

### 5 Seeded Buses (Bengaluru RTO Registrations):
- **Bus 01** (`KA-50-F-1101` - Yelahanka RTO) - Assigned to Route 1 (Driver: Ramesh Poojary)
- **Bus 02** (`KA-50-F-1102` - Yelahanka RTO) - Assigned to Route 1 (Driver: Suresh Shetty)
- **Bus 03** (`KA-53-F-2201` - KR Puram RTO) - Assigned to Route 2 (Driver: Anand Devadiga)
- **Bus 04** (`KA-53-F-2202` - KR Puram RTO) - Assigned to Route 2 (Driver: Ganesh Kulal)
- **Bus 05** (`KA-04-F-3301` - Yeshwanthpur RTO) - Assigned to Route 3 (Driver: Mohan Acharya)

---

## ⚡ Quickstart Guide

### 1. Database Seeding
```bash
npm run seed
```

### 2. Start Backend & Frontend
```bash
# Terminal 1: Backend API (port 5000)
npm run backend

# Terminal 2: Frontend PWA (port 5173)
npm run frontend
```

### 3. Run Bus Simulator for Live Demo
```bash
# Simulate Bus 01 moving along Route 1 (Majestic to NMIT Yelahanka)
npm run simulate

# Or simulate ALL 5 buses moving concurrently across Bengaluru!
npm run simulate:all
```

---

## 🔑 Demo Login Accounts

| Role | Email / Identifier | USN | Password |
|---|---|---|---|
| **Student** | `sanjit@nmit.ac.in` | `1NT21CS001` | `password123` |
| **Student** | `ananya@nmit.ac.in` | `1NT21EC045` | `password123` |
| **Driver** | `ramesh.poojary@nmit.ac.in` | — | `password123` |
| **Admin** | `admin@nmit.ac.in` | — | `admin123` |
