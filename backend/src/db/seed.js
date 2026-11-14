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

  console.log('[SEED] Inserting Single Route: Route 19 (Yelahanka Corridor)...');
  const routes = [
    {
      id: 'route-19',
      name: 'Route 19: Attur Layout - Yelahanka - NMIT Campus',
      code: 'R-19',
      start_location: 'Attur Layout, Yelahanka',
      end_location: 'NMIT Campus, Yelahanka',
      color: '#2563EB',
      is_active: 1
    }
  ];

  for (const r of routes) {
    await query(
      'INSERT INTO routes (id, name, code, start_location, end_location, color, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.name, r.code, r.start_location, r.end_location, r.color, r.is_active]
    );
  }

  console.log('[SEED] Inserting Route 19 Stops in Exact Sequence...');
  const stops = [
    {
      id: 'stop-r19-1',
      name: 'Attur Layout',
      landmark: 'Attur Layout Bus Stop, Yelahanka',
      latitude: 13.0994,
      longitude: 77.5680
    },
    {
      id: 'stop-r19-2',
      name: 'Yelahanka 5th Phase',
      landmark: '5th Phase, Yelahanka New Town',
      latitude: 13.1042,
      longitude: 77.5715
    },
    {
      id: 'stop-r19-3',
      name: '4th Phase',
      landmark: '4th Phase, Yelahanka New Town',
      latitude: 13.1025,
      longitude: 77.5762
    },
    {
      id: 'stop-r19-4',
      name: 'Dairy Circle',
      landmark: 'Mother Dairy Circle, Yelahanka',
      latitude: 13.1063,
      longitude: 77.5776
    },
    {
      id: 'stop-r19-5',
      name: 'New Town',
      landmark: 'Yelahanka New Town Bus Stand',
      latitude: 13.1005,
      longitude: 77.5815
    },
    {
      id: 'stop-r19-6',
      name: 'Chikkabommasandra',
      landmark: 'Chikkabommasandra Cross / Bus Stop',
      latitude: 13.0938,
      longitude: 77.5825
    },
    {
      id: 'stop-r19-7',
      name: 'Sharavathi',
      landmark: 'Sharavathi Hotel / 16th B Cross',
      latitude: 13.0985,
      longitude: 77.5855
    },
    {
      id: 'stop-r19-8',
      name: 'Seshadripuram College',
      landmark: 'Seshadripuram First Grade College (SFGC)',
      latitude: 13.1030,
      longitude: 77.5870
    },
    {
      id: 'stop-r19-9',
      name: 'NES',
      landmark: 'NES Bus Stop / Yelahanka Police Station',
      latitude: 13.1007,
      longitude: 77.5963
    },
    {
      id: 'stop-r19-10',
      name: 'Venkatala',
      landmark: 'Venkatala Bus Stop, NH 44 (Bellary Road)',
      latitude: 13.1138,
      longitude: 77.6023
    },
    {
      id: 'stop-nmit-campus',
      name: 'NMIT Campus Main Gate',
      landmark: 'Admin Block & Main Portico, Gollahalli, Yelahanka',
      latitude: 13.12939,
      longitude: 77.58790
    }
  ];

  for (const s of stops) {
    await query(
      'INSERT INTO stops (id, name, landmark, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
      [s.id, s.name, s.landmark, s.latitude, s.longitude]
    );
  }

  console.log('[SEED] Linking Route 19 Stops with Scheduled Timings...');
  const routeStops = [
    { id: 'rs-19-1', route_id: 'route-19', stop_id: 'stop-r19-1', stop_order: 1, m: '07:45 AM', e: '05:00 PM', dist: 0.0 },
    { id: 'rs-19-2', route_id: 'route-19', stop_id: 'stop-r19-2', stop_order: 2, m: '07:49 AM', e: '04:54 PM', dist: 0.8 },
    { id: 'rs-19-3', route_id: 'route-19', stop_id: 'stop-r19-3', stop_order: 3, m: '07:53 AM', e: '04:48 PM', dist: 0.7 },
    { id: 'rs-19-4', route_id: 'route-19', stop_id: 'stop-r19-4', stop_order: 4, m: '07:57 AM', e: '04:43 PM', dist: 0.6 },
    { id: 'rs-19-5', route_id: 'route-19', stop_id: 'stop-r19-5', stop_order: 5, m: '08:02 AM', e: '04:37 PM', dist: 0.9 },
    { id: 'rs-19-6', route_id: 'route-19', stop_id: 'stop-r19-6', stop_order: 6, m: '08:07 AM', e: '04:31 PM', dist: 0.9 },
    { id: 'rs-19-7', route_id: 'route-19', stop_id: 'stop-r19-7', stop_order: 7, m: '08:12 AM', e: '04:25 PM', dist: 0.7 },
    { id: 'rs-19-8', route_id: 'route-19', stop_id: 'stop-r19-8', stop_order: 8, m: '08:16 AM', e: '04:20 PM', dist: 0.8 },
    { id: 'rs-19-9', route_id: 'route-19', stop_id: 'stop-r19-9', stop_order: 9, m: '08:21 AM', e: '04:14 PM', dist: 1.2 },
    { id: 'rs-19-10', route_id: 'route-19', stop_id: 'stop-r19-10', stop_order: 10, m: '08:25 AM', e: '04:08 PM', dist: 1.8 },
    { id: 'rs-19-11', route_id: 'route-19', stop_id: 'stop-nmit-campus', stop_order: 11, m: '08:30 AM', e: '04:00 PM', dist: 2.8 }
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
    { id: 'user-drv-2', name: 'Suresh Shetty', email: 'suresh.shetty@nmit.ac.in', phone: '+91 98452 23344', role: 'driver' }
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

  console.log('[SEED] Inserting Bus 19...');
  const buses = [
    { id: 'bus-19', number: 'Bus 19', reg: 'KA-50-F-1919', cap: 54, route: 'route-19', driver: 'user-drv-1', status: 'idle' }
  ];

  for (const b of buses) {
    await query(
      'INSERT INTO buses (id, bus_number, registration_number, capacity, route_id, driver_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [b.id, b.number, b.reg, b.cap, b.route, b.driver, b.status]
    );
  }

  console.log('[SEED] Inserting NMIT Sample Students for Route 19...');
  const students = [
    {
      id: 'user-stu-1',
      name: 'Sanjit R S',
      email: 'sanjit@nmit.ac.in',
      usn: '1NT21CS001',
      phone: '+91 99001 23456',
      role: 'student',
      route_id: 'route-19',
      stop_id: 'stop-r19-8' // Seshadripuram College
    },
    {
      id: 'user-stu-2',
      name: 'Ananya Rao',
      email: 'ananya@nmit.ac.in',
      usn: '1NT21EC045',
      phone: '+91 99002 34567',
      role: 'student',
      route_id: 'route-19',
      stop_id: 'stop-r19-5' // New Town
    },
    {
      id: 'user-stu-3',
      name: 'Pratheek Nayak',
      email: 'pratheek@nmit.ac.in',
      usn: '1NT22IS089',
      phone: '+91 99003 45678',
      role: 'student',
      route_id: 'route-19',
      stop_id: 'stop-r19-1' // Attur Layout
    }
  ];

  for (const s of students) {
    await query(
      'INSERT INTO users (id, name, email, usn, phone, password_hash, role, route_id, stop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [s.id, s.name, s.email, s.usn, s.phone, defaultPasswordHash, s.role, s.route_id, s.stop_id]
    );
  }

  console.log('[SEED] Inserting Route 19 Announcements...');
  const announcements = [
    {
      id: 'ann-1',
      title: 'Route 19 Yelahanka Service Active',
      message: 'Bus 19 is operating normally via Attur Layout, 5th & 4th Phase, Dairy Circle, New Town, Chikkabommasandra, Sharavathi, Seshadripuram College, NES, and Venkatala to NMIT Campus.',
      category: 'delay',
      priority: 'normal',
      route_id: 'route-19',
      author_id: 'user-admin-1'
    },
    {
      id: 'ann-2',
      title: 'Anaadyanta 2026 Special Bus Service',
      message: 'Special Route 19 return buses will depart NMIT Yelahanka Campus at 08:30 PM and 10:00 PM on college fest days.',
      category: 'holiday',
      priority: 'normal',
      route_id: null,
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

  console.log('[SEED] Successfully seeded database with Route 19 for NMIT Yelahanka Bengaluru Campus!');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('[SEED] Failed:', err);
    process.exit(1);
  });
}

module.exports = { seed };
