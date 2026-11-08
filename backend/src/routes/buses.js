const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, get, all } = require('../config/db');

// GET all buses with driver and route details
router.get('/', async (req, res) => {
  try {
    const buses = await all(`
      SELECT b.*,
             r.name as route_name, r.code as route_code, r.color as route_color,
             u.name as driver_name, u.phone as driver_phone,
             t.id as active_trip_id, t.direction as trip_direction, t.status as trip_status,
             t.current_latitude, t.current_longitude, t.current_speed, t.heading,
             t.next_stop_id, t.next_stop_eta_minutes, t.last_ping_time,
             ns.name as next_stop_name
      FROM buses b
      LEFT JOIN routes r ON b.route_id = r.id
      LEFT JOIN users u ON b.driver_id = u.id
      LEFT JOIN trips t ON b.id = t.bus_id AND t.status IN ('on_the_way', 'delayed', 'breakdown', 'offline')
      LEFT JOIN stops ns ON t.next_stop_id = ns.id
      ORDER BY b.bus_number ASC
    `);

    res.json({ success: true, buses });
  } catch (err) {
    console.error('[BUSES] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch buses' });
  }
});

// GET single bus details
router.get('/:id', async (req, res) => {
  try {
    const bus = await get(`
      SELECT b.*,
             r.name as route_name, r.code as route_code, r.color as route_color,
             u.name as driver_name, u.phone as driver_phone,
             t.id as active_trip_id, t.direction as trip_direction, t.status as trip_status,
             t.current_latitude, t.current_longitude, t.current_speed, t.heading,
             t.next_stop_id, t.next_stop_eta_minutes, t.last_ping_time
      FROM buses b
      LEFT JOIN routes r ON b.route_id = r.id
      LEFT JOIN users u ON b.driver_id = u.id
      LEFT JOIN trips t ON b.id = t.bus_id AND t.status IN ('on_the_way', 'delayed', 'breakdown', 'offline')
      WHERE b.id = ?
    `, [req.params.id]);

    if (!bus) return res.status(404).json({ error: 'Bus not found' });
    res.json({ success: true, bus });
  } catch (err) {
    console.error('[BUSES] Single bus error:', err);
    res.status(500).json({ error: 'Failed to fetch bus' });
  }
});

// ADMIN: Add new bus
router.post('/', async (req, res) => {
  try {
    const { bus_number, registration_number, capacity = 52, route_id, driver_id, status = 'idle' } = req.body;

    if (!bus_number || !registration_number) {
      return res.status(400).json({ error: 'Bus number and registration number are required' });
    }

    const id = `bus-${Date.now()}`;
    await query(
      `INSERT INTO buses (id, bus_number, registration_number, capacity, route_id, driver_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, bus_number, registration_number, capacity, route_id || null, driver_id || null, status]
    );

    const bus = await get('SELECT * FROM buses WHERE id = ?', [id]);
    res.status(201).json({ success: true, bus });
  } catch (err) {
    console.error('[BUSES] Create error:', err);
    res.status(500).json({ error: 'Failed to create bus' });
  }
});

// ADMIN: Edit bus & assignment
router.put('/:id', async (req, res) => {
  try {
    const { bus_number, registration_number, capacity, route_id, driver_id, status } = req.body;

    await query(
      `UPDATE buses
       SET bus_number = COALESCE(?, bus_number),
           registration_number = COALESCE(?, registration_number),
           capacity = COALESCE(?, capacity),
           route_id = COALESCE(?, route_id),
           driver_id = COALESCE(?, driver_id),
           status = COALESCE(?, status)
       WHERE id = ?`,
      [bus_number, registration_number, capacity, route_id, driver_id, status, req.params.id]
    );

    const updated = await get('SELECT * FROM buses WHERE id = ?', [req.params.id]);
    res.json({ success: true, bus: updated });
  } catch (err) {
    console.error('[BUSES] Update error:', err);
    res.status(500).json({ error: 'Failed to update bus' });
  }
});

// ADMIN: Delete bus
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM buses WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Bus deleted successfully' });
  } catch (err) {
    console.error('[BUSES] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete bus' });
  }
});

// GET all drivers (for assignment)
router.get('/meta/drivers', async (req, res) => {
  try {
    const drivers = await all(`
      SELECT u.id, u.name, u.email, u.phone,
             b.id as assigned_bus_id, b.bus_number as assigned_bus_number
      FROM users u
      LEFT JOIN buses b ON u.id = b.driver_id
      WHERE u.role = 'driver'
      ORDER BY u.name ASC
    `);

    res.json({ success: true, drivers });
  } catch (err) {
    console.error('[BUSES] Drivers fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// ADMIN: Create driver
router.post('/meta/drivers', async (req, res) => {
  try {
    const { name, email, phone, password = 'password123' } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required for driver' });
    }

    const id = `user-drv-${Date.now()}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    await query(
      `INSERT INTO users (id, name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?, 'driver')`,
      [id, name, email || `${name.toLowerCase().replace(/\s+/g, '')}@nitte.edu.in`, phone, passwordHash]
    );

    const driver = await get('SELECT id, name, email, phone, role FROM users WHERE id = ?', [id]);
    res.status(201).json({ success: true, driver });
  } catch (err) {
    console.error('[BUSES] Create driver error:', err);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

module.exports = router;
