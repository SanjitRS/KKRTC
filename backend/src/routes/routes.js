const express = require('express');
const router = express.Router();
const { query, get, all } = require('../config/db');
const { clearRouteStopsCache } = require('../services/trackingEngine');

// GET all routes with stop counts & active buses
router.get('/', async (req, res) => {
  try {
    const routes = await all(`
      SELECT r.*,
             (SELECT COUNT(*) FROM route_stops WHERE route_id = r.id) as stops_count,
             (SELECT COUNT(*) FROM buses WHERE route_id = r.id) as buses_count,
             (SELECT COUNT(*) FROM trips WHERE route_id = r.id AND status IN ('on_the_way', 'delayed', 'breakdown')) as active_trips_count
      FROM routes r
      ORDER BY r.code ASC
    `);

    res.json({ success: true, routes });
  } catch (err) {
    console.error('[ROUTES] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

const { fetchRoadGeometry } = require('../services/roadRouter');

// GET route details with ordered stops
router.get('/:id', async (req, res) => {
  try {
    const route = await get('SELECT * FROM routes WHERE id = ?', [req.params.id]);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const stops = await all(`
      SELECT rs.id as route_stop_id, rs.stop_order, rs.scheduled_time_morning, rs.scheduled_time_evening, rs.distance_from_prev_km,
             s.id, s.name, s.landmark, s.latitude, s.longitude
      FROM route_stops rs
      JOIN stops s ON rs.stop_id = s.id
      WHERE rs.route_id = ?
      ORDER BY rs.stop_order ASC
    `, [req.params.id]);

    const buses = await all(`
      SELECT b.*, u.name as driver_name, u.phone as driver_phone,
             t.id as active_trip_id, t.direction as trip_direction, t.status as trip_status,
             t.current_latitude, t.current_longitude, t.current_speed, t.heading,
             t.next_stop_id, t.next_stop_eta_minutes, t.last_ping_time
      FROM buses b
      LEFT JOIN users u ON b.driver_id = u.id
      LEFT JOIN trips t ON b.id = t.bus_id AND t.status IN ('on_the_way', 'delayed', 'breakdown', 'offline')
      WHERE b.route_id = ?
    `, [req.params.id]);

    // Fetch exact road polyline coordinates
    const roadGeometry = await fetchRoadGeometry(stops);

    res.json({ success: true, route, stops, buses, road_geometry: roadGeometry });
  } catch (err) {
    console.error('[ROUTES] Details error:', err);
    res.status(500).json({ error: 'Failed to fetch route details' });
  }
});

// ADMIN: Add new route
router.post('/', async (req, res) => {
  try {
    const { name, code, start_location, end_location, color = '#2563EB' } = req.body;
    if (!name || !code || !start_location || !end_location) {
      return res.status(400).json({ error: 'Name, code, start_location, and end_location are required' });
    }

    const id = `route-${Date.now()}`;
    await query(
      `INSERT INTO routes (id, name, code, start_location, end_location, color, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, name, code, start_location, end_location, color]
    );

    const created = await get('SELECT * FROM routes WHERE id = ?', [id]);
    res.status(201).json({ success: true, route: created });
  } catch (err) {
    console.error('[ROUTES] Create route error:', err);
    res.status(500).json({ error: 'Failed to create route' });
  }
});

// ADMIN: Update route
router.put('/:id', async (req, res) => {
  try {
    const { name, code, start_location, end_location, color, is_active } = req.body;
    await query(
      `UPDATE routes
       SET name = COALESCE(?, name),
           code = COALESCE(?, code),
           start_location = COALESCE(?, start_location),
           end_location = COALESCE(?, end_location),
           color = COALESCE(?, color),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, code, start_location, end_location, color, is_active, req.params.id]
    );

    clearRouteStopsCache(req.params.id);
    const updated = await get('SELECT * FROM routes WHERE id = ?', [req.params.id]);
    res.json({ success: true, route: updated });
  } catch (err) {
    console.error('[ROUTES] Update route error:', err);
    res.status(500).json({ error: 'Failed to update route' });
  }
});

// ADMIN: Delete route
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM routes WHERE id = ?', [req.params.id]);
    clearRouteStopsCache(req.params.id);
    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (err) {
    console.error('[ROUTES] Delete route error:', err);
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

// ADMIN: Add or replace stops for a route
router.post('/:id/stops', async (req, res) => {
  try {
    const { stops } = req.body; // Array of { stop_id, stop_order, scheduled_time_morning, scheduled_time_evening, distance_from_prev_km }
    const routeId = req.params.id;

    if (!Array.isArray(stops)) {
      return res.status(400).json({ error: 'Stops array is required' });
    }

    // Delete existing route stops
    await query('DELETE FROM route_stops WHERE route_id = ?', [routeId]);

    // Insert new route stops
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      const rsId = `rs-${routeId}-${i + 1}-${Date.now()}`;
      await query(
        `INSERT INTO route_stops (id, route_id, stop_id, stop_order, scheduled_time_morning, scheduled_time_evening, distance_from_prev_km)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          rsId,
          routeId,
          s.stop_id,
          s.stop_order || i + 1,
          s.scheduled_time_morning || null,
          s.scheduled_time_evening || null,
          s.distance_from_prev_km || 0
        ]
      );
    }

    clearRouteStopsCache(routeId);
    res.json({ success: true, message: 'Route stops updated successfully' });
  } catch (err) {
    console.error('[ROUTES] Update stops error:', err);
    res.status(500).json({ error: 'Failed to update route stops' });
  }
});

// STOPS: Get all master stops
router.get('/stops/all', async (req, res) => {
  try {
    const stops = await all('SELECT * FROM stops ORDER BY name ASC');
    res.json({ success: true, stops });
  } catch (err) {
    console.error('[STOPS] Fetch stops error:', err);
    res.status(500).json({ error: 'Failed to fetch stops' });
  }
});

// STOPS: Create new stop with map coordinates
router.post('/stops/create', async (req, res) => {
  try {
    const { name, landmark, latitude, longitude } = req.body;
    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    }

    const id = `stop-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    await query(
      'INSERT INTO stops (id, name, landmark, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
      [id, name, landmark || '', parseFloat(latitude), parseFloat(longitude)]
    );

    const created = await get('SELECT * FROM stops WHERE id = ?', [id]);
    res.status(201).json({ success: true, stop: created });
  } catch (err) {
    console.error('[STOPS] Create stop error:', err);
    res.status(500).json({ error: 'Failed to create stop' });
  }
});

// STOPS: Update stop
router.put('/stops/:id', async (req, res) => {
  try {
    const { name, landmark, latitude, longitude } = req.body;
    await query(
      `UPDATE stops
       SET name = COALESCE(?, name),
           landmark = COALESCE(?, landmark),
           latitude = COALESCE(?, latitude),
           longitude = COALESCE(?, longitude)
       WHERE id = ?`,
      [name, landmark, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, req.params.id]
    );

    clearRouteStopsCache();
    const updated = await get('SELECT * FROM stops WHERE id = ?', [req.params.id]);
    res.json({ success: true, stop: updated });
  } catch (err) {
    console.error('[STOPS] Update stop error:', err);
    res.status(500).json({ error: 'Failed to update stop' });
  }
});

// STOPS: Delete stop
router.delete('/stops/:id', async (req, res) => {
  try {
    await query('DELETE FROM stops WHERE id = ?', [req.params.id]);
    clearRouteStopsCache();
    res.json({ success: true, message: 'Stop deleted successfully' });
  } catch (err) {
    console.error('[STOPS] Delete stop error:', err);
    res.status(500).json({ error: 'Failed to delete stop' });
  }
});

module.exports = router;
