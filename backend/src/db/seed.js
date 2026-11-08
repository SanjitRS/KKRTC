const bcrypt = require('bcryptjs');
const { initDB, query, getDbMode, saveSqliteToFile } = require('../config/db');

async function seed() {
  console.log('[SEED] Initializing database for NMIT (Nitte Meenakshi Institute of Technology, Yelahanka, Bengaluru)...');
  await initDB();

  console.log('[SEED] Clearing existing data...');
  await query('DELETE FROM location_updates');
  await query('DELETE FROM announcements');
  await query('DELETE FROM trips');
  await query('DELETE FROM route_stops');
  await query('DELETE FROM buses');
  await query('DELETE FROM users');
  await query('DELETE FROM stops');
  await query('DELETE FROM routes');

  const defaultPasswordHash = bcrypt.hashSync('password123', 10);
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);

  console.log('[SEED] Inserting NMIT Bengaluru Routes...');
  const routes = [
    {
      id: 'route-1',
      name: 'Route 1: Majestic (KBS) - Hebbal - NMIT Yelahanka',
      code: 'R1-MAJ',
      start_location: 'Kempegowda Bus Station (Majestic)',
      end_location: 'NMIT Campus, Yelahanka',
      color: '#2563EB',
      is_active: 1
    },
    {
      id: 'route-2',
      name: 'Route 2: Whitefield - KR Puram - Manyata - NMIT Yelahanka',
      code: 'R2-WTF',
      start_location: 'ITPL / Whitefield',
      end_location: 'NMIT Campus, Yelahanka',
      color: '#059669',
      is_active: 1
    },
    {
      id: 'route-3',
      name: 'Route 3: Vijayanagar - Rajajinagar - BEL - NMIT Yelahanka',
      code: 'R3-VJR',
      start_location: 'Vijayanagar TTMC',
      end_location: 'NMIT Campus, Yelahanka',
      color: '#D97706',
      is_active: 1
    }
  ];

  for (const r of routes) {
    await query(
      'INSERT INTO routes (id, name, code, start_location, end_location, color, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.name, r.code, r.start_location, r.end_location, r.color, r.is_active]
    );
  }

  console.log('[SEED] Inserting Realistic Bengaluru / NMIT Stops...');
  const stops = [
    // NMIT Campus Terminus (Govindapura, Gollahalli, Yelahanka)
    { id: 'stop-nmit-campus', name: 'NMIT Main Gate (Yelahanka Campus)', landmark: 'Admin Block & Main Portico, Gollahalli', latitude: 13.12939, longitude: 77.58790 },

    // Route 1 Stops (Majestic to NMIT via Bellary Road / Airport Corridor)
    { id: 'stop-r1-1', name: 'Kempegowda Bus Station (Majestic)', landmark: 'BMTC Terminal 1 / Opp Metro Station', latitude: 12.9774, longitude: 77.5708 },
    { id: 'stop-r1-2', name: 'Malleshwaram 8th Cross', landmark: 'Near Malleshwaram Circle', latitude: 12.9988, longitude: 77.5704 },
    { id: 'stop-r1-3', name: 'Yeshwanthpur TTMC', landmark: 'Railway Station / Metro Pillar', latitude: 13.0238, longitude: 77.5503 },
    { id: 'stop-r1-4', name: 'IISc / Tata Institute', landmark: 'Gymkhana Gate, CV Raman Road', latitude: 13.0185, longitude: 77.5726 },
    { id: 'stop-r1-5', name: 'Mekhri Circle Underpass', landmark: 'Palace Grounds Entrance Gate', latitude: 13.0076, longitude: 77.5835 },
    { id: 'stop-r1-6', name: 'Hebbal Flyover (Esteem Mall)', landmark: 'Near Hebbal Lake Bus Bay', latitude: 13.0382, longitude: 77.5919 },
    { id: 'stop-r1-7', name: 'Kodigehalli Gate', landmark: 'Bellary Road Service Road', latitude: 13.0645, longitude: 77.5908 },
    { id: 'stop-r1-8', name: 'Jakkur Cross', landmark: 'Opp. Flying Club / Highway Cross', latitude: 13.0805, longitude: 77.5960 },
    { id: 'stop-r1-9', name: 'Yelahanka Police Station / NES', landmark: 'NES Office & Yelahanka Old Town', latitude: 13.1007, longitude: 77.5963 },

    // Route 2 Stops (Whitefield & Outer Ring Road to NMIT)
    { id: 'stop-r2-1', name: 'ITPL / Whitefield Main Gate', landmark: 'International Tech Park Entrance', latitude: 12.9863, longitude: 77.7289 },
    { id: 'stop-r2-2', name: 'Hoodi Circle', landmark: 'Hoodi Railway Bridge Junction', latitude: 12.9920, longitude: 77.7126 },
    { id: 'stop-r2-3', name: 'KR Puram Hanging Bridge', landmark: 'Tin Factory Bus Bay', latitude: 13.0012, longitude: 77.6748 },
    { id: 'stop-r2-4', name: 'Ramamurthy Nagar Ring Road', landmark: 'Underpass Junction', latitude: 13.0163, longitude: 77.6680 },
    { id: 'stop-r2-5', name: 'Kalyan Nagar / HRBR Layout', landmark: 'Kalyan Nagar Bus Depot', latitude: 13.0232, longitude: 77.6432 },
    { id: 'stop-r2-6', name: 'Nagavara Junction (Manyata Tech Park)', landmark: 'Manyata Gate 1 / ORR Junction', latitude: 13.0441, longitude: 77.6204 },
    { id: 'stop-r2-7', name: 'Thanisandra Main Road', landmark: 'Near Bharatiya City Turn', latitude: 13.0580, longitude: 77.6290 },
    { id: 'stop-r2-8', name: 'Kogilu Cross Junction', landmark: 'Kogilu Main Road Traffic Light', latitude: 13.1118, longitude: 77.6042 },

    // Route 3 Stops (Vijayanagar & West Bengaluru to NMIT)
    { id: 'stop-r3-1', name: 'Vijayanagar TTMC', landmark: 'Vijayanagar Metro Station', latitude: 12.9719, longitude: 77.5372 },
    { id: 'stop-r3-2', name: 'Navrang Theatre / Rajajinagar', landmark: '1st Block Rajajinagar', latitude: 12.9935, longitude: 77.5539 },
    { id: 'stop-r3-3', name: 'Mahalakshmi Layout Metro', landmark: 'Near ISKCON Temple Road', latitude: 13.0083, longitude: 77.5492 },
    { id: 'stop-r3-4', name: 'Peenya 1st Stage', landmark: 'Peenya Industrial Area Entrance', latitude: 13.0285, longitude: 77.5255 },
    { id: 'stop-r3-5', name: 'Jalahalli Cross', landmark: 'Tumkur Road Flyover Junction', latitude: 13.0446, longitude: 77.5195 },
    { id: 'stop-r3-6', name: 'BEL Circle / Vidyaranyapura Cross', landmark: 'Bharat Electronics Ltd Main Gate', latitude: 13.0560, longitude: 77.5540 },
    { id: 'stop-r3-7', name: 'Vidyaranyapura Post Office', landmark: 'Vidyaranyapura Main Bus Stand', latitude: 13.0780, longitude: 77.5610 }
  ];

  for (const s of stops) {
    await query(
      'INSERT INTO stops (id, name, landmark, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
      [s.id, s.name, s.landmark, s.latitude, s.longitude]
    );
  }

  console.log('[SEED] Linking Route Stops with Scheduled Times...');
  const routeStops = [
    // Route 1 (10 stops)
    { id: 'rs-1-1', route_id: 'route-1', stop_id: 'stop-r1-1', stop_order: 1, m: '07:00 AM', e: '05:40 PM', dist: 0.0 },
    { id: 'rs-1-2', route_id: 'route-1', stop_id: 'stop-r1-2', stop_order: 2, m: '07:12 AM', e: '05:25 PM', dist: 2.8 },
    { id: 'rs-1-3', route_id: 'route-1', stop_id: 'stop-r1-3', stop_order: 3, m: '07:25 AM', e: '05:12 PM', dist: 3.5 },
    { id: 'rs-1-4', route_id: 'route-1', stop_id: 'stop-r1-4', stop_order: 4, m: '07:35 AM', e: '05:02 PM', dist: 2.4 },
    { id: 'rs-1-5', route_id: 'route-1', stop_id: 'stop-r1-5', stop_order: 5, m: '07:45 AM', e: '04:50 PM', dist: 2.1 },
    { id: 'rs-1-6', route_id: 'route-1', stop_id: 'stop-r1-6', stop_order: 6, m: '07:58 AM', e: '04:35 PM', dist: 3.8 },
    { id: 'rs-1-7', route_id: 'route-1', stop_id: 'stop-r1-7', stop_order: 7, m: '08:08 AM', e: '04:25 PM', dist: 3.0 },
    { id: 'rs-1-8', route_id: 'route-1', stop_id: 'stop-r1-8', stop_order: 8, m: '08:15 AM', e: '04:18 PM', dist: 2.2 },
    { id: 'rs-1-9', route_id: 'route-1', stop_id: 'stop-r1-9', stop_order: 9, m: '08:22 AM', e: '04:10 PM', dist: 2.5 },
    { id: 'rs-1-10', route_id: 'route-1', stop_id: 'stop-nmit-campus', stop_order: 10, m: '08:30 AM', e: '04:00 PM', dist: 3.4 },

    // Route 2 (9 stops)
    { id: 'rs-2-1', route_id: 'route-2', stop_id: 'stop-r2-1', stop_order: 1, m: '06:55 AM', e: '05:45 PM', dist: 0.0 },
    { id: 'rs-2-2', route_id: 'route-2', stop_id: 'stop-r2-2', stop_order: 2, m: '07:05 AM', e: '05:35 PM', dist: 2.5 },
    { id: 'rs-2-3', route_id: 'route-2', stop_id: 'stop-r2-3', stop_order: 3, m: '07:20 AM', e: '05:20 PM', dist: 4.8 },
    { id: 'rs-2-4', route_id: 'route-2', stop_id: 'stop-r2-4', stop_order: 4, m: '07:32 AM', e: '05:08 PM', dist: 2.2 },
    { id: 'rs-2-5', route_id: 'route-2', stop_id: 'stop-r2-5', stop_order: 5, m: '07:45 AM', e: '04:55 PM', dist: 3.1 },
    { id: 'rs-2-6', route_id: 'route-2', stop_id: 'stop-r2-6', stop_order: 6, m: '08:00 AM', e: '04:40 PM', dist: 3.6 },
    { id: 'rs-2-7', route_id: 'route-2', stop_id: 'stop-r2-7', stop_order: 7, m: '08:10 AM', e: '04:30 PM', dist: 2.5 },
    { id: 'rs-2-8', route_id: 'route-2', stop_id: 'stop-r2-8', stop_order: 8, m: '08:20 AM', e: '04:15 PM', dist: 6.2 },
    { id: 'rs-2-9', route_id: 'route-2', stop_id: 'stop-nmit-campus', stop_order: 9, m: '08:30 AM', e: '04:00 PM', dist: 3.1 },

    // Route 3 (8 stops)
    { id: 'rs-3-1', route_id: 'route-3', stop_id: 'stop-r3-1', stop_order: 1, m: '07:05 AM', e: '05:35 PM', dist: 0.0 },
    { id: 'rs-3-2', route_id: 'route-3', stop_id: 'stop-r3-2', stop_order: 2, m: '07:20 AM', e: '05:20 PM', dist: 3.2 },
    { id: 'rs-3-3', route_id: 'route-3', stop_id: 'stop-r3-3', stop_order: 3, m: '07:30 AM', e: '05:10 PM', dist: 2.0 },
    { id: 'rs-3-4', route_id: 'route-3', stop_id: 'stop-r3-4', stop_order: 4, m: '07:42 AM', e: '04:58 PM', dist: 3.5 },
    { id: 'rs-3-5', route_id: 'route-3', stop_id: 'stop-r3-5', stop_order: 5, m: '07:55 AM', e: '04:45 PM', dist: 2.4 },
    { id: 'rs-3-6', route_id: 'route-3', stop_id: 'stop-r3-6', stop_order: 6, m: '08:08 AM', e: '04:30 PM', dist: 4.1 },
    { id: 'rs-3-7', route_id: 'route-3', stop_id: 'stop-r3-7', stop_order: 7, m: '08:16 AM', e: '04:20 PM', dist: 3.0 },
    { id: 'rs-3-8', route_id: 'route-3', stop_id: 'stop-nmit-campus', stop_order: 8, m: '08:30 AM', e: '04:00 PM', dist: 6.5 }
  ];

  for (const rs of routeStops) {
    await query(
      'INSERT INTO route_stops (id, route_id, stop_id, stop_order, scheduled_time_morning, scheduled_time_evening, distance_from_prev_km) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [rs.id, rs.route_id, rs.stop_id, rs.stop_order, rs.m, rs.e, rs.dist]
    );
  }

  console.log('[SEED] Inserting Drivers and Transport Office Admin...');
  const drivers = [
    { id: 'user-drv-1', name: 'Ramesh Poojary', email: 'ramesh.poojary@nmit.ac.in', phone: '+91 98451 12233', role: 'driver' },
    { id: 'user-drv-2', name: 'Suresh Shetty', email: 'suresh.shetty@nmit.ac.in', phone: '+91 98452 23344', role: 'driver' },
    { id: 'user-drv-3', name: 'Anand Devadiga', email: 'anand.devadiga@nmit.ac.in', phone: '+91 98453 34455', role: 'driver' },
    { id: 'user-drv-4', name: 'Ganesh Kulal', email: 'ganesh.kulal@nmit.ac.in', phone: '+91 98454 45566', role: 'driver' },
    { id: 'user-drv-5', name: 'Mohan Acharya', email: 'mohan.acharya@nmit.ac.in', phone: '+91 98455 56677', role: 'driver' }
  ];

  for (const d of drivers) {
    await query(
      'INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [d.id, d.name, d.email, d.phone, defaultPasswordHash, d.role]
    );
  }

  // Admin user
  await query(
    'INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
    ['user-admin-1', 'NMIT Transport Office (Admin)', 'admin@nmit.ac.in', '+91 80 2216 7800', adminPasswordHash, 'admin']
  );

  console.log('[SEED] Inserting 5 NMIT Buses with Bengaluru Registrations...');
  const buses = [
    { id: 'bus-1', number: 'Bus 01', reg: 'KA-50-F-1101', cap: 54, route: 'route-1', driver: 'user-drv-1', status: 'idle' },
    { id: 'bus-2', number: 'Bus 02', reg: 'KA-50-F-1102', cap: 54, route: 'route-1', driver: 'user-drv-2', status: 'idle' },
    { id: 'bus-3', number: 'Bus 03', reg: 'KA-53-F-2201', cap: 50, route: 'route-2', driver: 'user-drv-3', status: 'idle' },
    { id: 'bus-4', number: 'Bus 04', reg: 'KA-53-F-2202', cap: 50, route: 'route-2', driver: 'user-drv-4', status: 'idle' },
    { id: 'bus-5', number: 'Bus 05', reg: 'KA-04-F-3301', cap: 48, route: 'route-3', driver: 'user-drv-5', status: 'idle' }
  ];

  for (const b of buses) {
    await query(
      'INSERT INTO buses (id, bus_number, registration_number, capacity, route_id, driver_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [b.id, b.number, b.reg, b.cap, b.route, b.driver, b.status]
    );
  }

  console.log('[SEED] Inserting NMIT Sample Students...');
  const students = [
    {
      id: 'user-stu-1',
      name: 'Sanjit R S',
      email: 'sanjit@nmit.ac.in',
      usn: '1NT21CS001',
      phone: '+91 99001 23456',
      role: 'student',
      route_id: 'route-1',
      stop_id: 'stop-r1-6' // Hebbal Flyover (Esteem Mall)
    },
    {
      id: 'user-stu-2',
      name: 'Ananya Rao',
      email: 'ananya@nmit.ac.in',
      usn: '1NT21EC045',
      phone: '+91 99002 34567',
      role: 'student',
      route_id: 'route-2',
      stop_id: 'stop-r2-6' // Nagavara Junction (Manyata Tech Park)
    },
    {
      id: 'user-stu-3',
      name: 'Pratheek Nayak',
      email: 'pratheek@nmit.ac.in',
      usn: '1NT22IS089',
      phone: '+91 99003 45678',
      role: 'student',
      route_id: 'route-3',
      stop_id: 'stop-r3-6' // BEL Circle / Vidyaranyapura Cross
    }
  ];

  for (const s of students) {
    await query(
      'INSERT INTO users (id, name, email, usn, phone, password_hash, role, route_id, stop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [s.id, s.name, s.email, s.usn, s.phone, defaultPasswordHash, s.role, s.route_id, s.stop_id]
    );
  }

  console.log('[SEED] Inserting NMIT Announcements...');
  const announcements = [
    {
      id: 'ann-1',
      title: 'Hebbal Flyover Traffic Advisory',
      message: 'Due to flyover expansion near Hebbal Lake, Route 1 morning buses are taking the service road. Students at Kodigehalli and Jakkur please be at stops 5 min early.',
      category: 'delay',
      priority: 'urgent',
      route_id: 'route-1',
      author_id: 'user-admin-1'
    },
    {
      id: 'ann-2',
      title: 'Anaadyanta 2026 Special Bus Service',
      message: 'Special return buses will depart NMIT Yelahanka Campus at 08:30 PM and 10:00 PM for all three routes on college fest days.',
      category: 'holiday',
      priority: 'normal',
      route_id: null,
      author_id: 'user-admin-1'
    },
    {
      id: 'ann-3',
      title: 'Kogilu Cross Road Work Diversion',
      message: 'BBMP road resurfacing work near Kogilu Cross. Route 2 buses will follow the Yelahanka bypass road.',
      category: 'route_change',
      priority: 'normal',
      route_id: 'route-2',
      author_id: 'user-admin-1'
    }
  ];

  for (const a of announcements) {
    await query(
      'INSERT INTO announcements (id, title, message, category, priority, route_id, author_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [a.id, a.title, a.message, a.category, a.priority, a.route_id, a.author_id]
    );
  }

  if (getDbMode() === 'sqlite') {
    saveSqliteToFile();
  }

  console.log('[SEED] Successfully seeded database for NMIT Yelahanka Bengaluru Campus!');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('[SEED] Failed:', err);
    process.exit(1);
  });
}

module.exports = { seed };
