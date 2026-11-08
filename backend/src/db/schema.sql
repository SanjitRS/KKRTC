-- NITTE Bus Tracker Database Schema
-- Compatible with SQLite and PostgreSQL

CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    color TEXT DEFAULT '#2563EB',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    landmark TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_stops (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    stop_id TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    stop_order INTEGER NOT NULL,
    scheduled_time_morning TEXT,
    scheduled_time_evening TEXT,
    distance_from_prev_km REAL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    usn TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student', 'driver', 'admin')),
    route_id TEXT REFERENCES routes(id) ON DELETE SET NULL,
    stop_id TEXT REFERENCES stops(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buses (
    id TEXT PRIMARY KEY,
    bus_number TEXT NOT NULL UNIQUE,
    registration_number TEXT NOT NULL UNIQUE,
    capacity INTEGER DEFAULT 52,
    route_id TEXT REFERENCES routes(id) ON DELETE SET NULL,
    driver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle', 'on_trip', 'delayed', 'breakdown', 'maintenance')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    bus_id TEXT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK(direction IN ('morning', 'evening')),
    status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started', 'on_the_way', 'arrived', 'delayed', 'breakdown', 'offline')),
    current_latitude REAL,
    current_longitude REAL,
    current_speed REAL DEFAULT 0.0,
    heading REAL DEFAULT 0.0,
    next_stop_id TEXT REFERENCES stops(id),
    next_stop_eta_minutes INTEGER DEFAULT 0,
    last_status_note TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    last_ping_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS location_updates (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    bus_id TEXT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed REAL DEFAULT 0.0,
    heading REAL DEFAULT 0.0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'general' CHECK(category IN ('general', 'delay', 'route_change', 'breakdown', 'holiday')),
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('normal', 'urgent')),
    route_id TEXT REFERENCES routes(id) ON DELETE CASCADE,
    author_id TEXT REFERENCES users(id),
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_usn ON users(usn);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_buses_route ON buses(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_bus_active ON trips(bus_id, status);
CREATE INDEX IF NOT EXISTS idx_location_updates_trip ON location_updates(trip_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_announcements_route ON announcements(route_id);
