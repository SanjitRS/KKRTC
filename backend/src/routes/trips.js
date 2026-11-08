const express = require('express');
const router = express.Router();
const { query, get, all } = require('../config/db');
const { processLocationUpdate, getIo, getRouteStops } = require('../services/trackingEngine');
const { calculateRouteProgression } = require('../services/etaCalculator');

// GET all active trips across all routes (for Admin and Student overview)
router.get('/active', async (req, res) => {
  try {
    const trips = await all(`
      SELECT t.*,
             b.bus_number, b.registration_number, b.capacity,
             r.name as route_name, r.code as route_code, r.color as route_color,
             u.name as driver_name, u.phone as driver_phone,
             ns.name as next_stop_name, ns.latitude as next_stop_latitude, ns.longitude as next_stop_longitude
      FROM trips t
      JOIN buses b ON t.bus_id = b.id
      JOIN routes r ON t.route_id = r.id
      JOIN users u ON t.driver_id = u.id
      LEFT JOIN stops ns ON t.next_stop_id = ns.id
      WHERE t.status IN ('on_the_way', 'delayed', 'breakdown', 'offline')
      ORDER BY t.start_time DESC
    `);

    // Attach computed ETAs and passed stops for each active trip
    const enrichedTrips = await Promise.all(
      trips.map(async (t) => {
        const stops = await getRouteStops(t.route_id);
        const progression = calculateRouteProgression(
          stops,
          t.current_latitude || 0,
          t.current_longitude || 0,
          t.current_speed || 30,
          t.direction || 'morning'
        );

        return {
          ...t,
          stopETAs: progression.stopETAs,
          passedStopIds: progression.passedStopIds,
          totalDistanceRemainingKm: progression.totalDistanceRemainingKm,
          effectiveSpeedKmh: progression.effectiveSpeedKmh
        };
      })
    );

    res.json({ success: true, trips: enrichedTrips });
  } catch (err) {
    console.error('[TRIPS] Fetch active trips error:', err);
    res.status(500).json({ error: 'Failed to fetch active trips' });
  }
});

// GET active trip for a specific route
router.get('/route/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const trip = await get(`
      SELECT t.*,
             b.bus_number, b.registration_number, b.capacity,
             r.name as route_name, r.code as route_code, r.color as route_color,
             u.name as driver_name, u.phone as driver_phone,
             ns.name as next_stop_name
      FROM trips t
      JOIN buses b ON t.bus_id = b.id
      JOIN routes r ON t.route_id = r.id
      JOIN users u ON t.driver_id = u.id
      LEFT JOIN stops ns ON t.next_stop_id = ns.id
      WHERE t.route_id = ? AND t.status IN ('on_the_way', 'delayed', 'breakdown', 'offline')
      ORDER BY t.start_time DESC
      LIMIT 1
    `, [routeId]);

    if (!trip) {
      return res.json({ success: true, active: false, trip: null });
    }

    const stops = await getRouteStops(routeId);
    const progression = calculateRouteProgression(
      stops,
      trip.current_latitude || 0,
      trip.current_longitude || 0,
      trip.current_speed || 30,
      trip.direction || 'morning'
    );

    res.json({
      success: true,
      active: true,
      trip: {
        ...trip,
        stopETAs: progression.stopETAs,
        passedStopIds: progression.passedStopIds,
        nextStop: progression.nextStop,
        totalDistanceRemainingKm: progression.totalDistanceRemainingKm,
        effectiveSpeedKmh: progression.effectiveSpeedKmh
      }
    });
  } catch (err) {
    console.error('[TRIPS] Route trip error:', err);
    res.status(500).json({ error: 'Failed to fetch route trip' });
  }
});

// Driver: Start Trip
router.post('/start', async (req, res) => {
  try {
    const { busId, routeId, driverId, direction = 'morning' } = req.body;
    if (!busId || !routeId || !driverId) {
      return res.status(400).json({ error: 'busId, routeId, and driverId are required' });
    }

    let activeTrip = await get(
      `SELECT * FROM trips WHERE bus_id = ? AND status != 'arrived'`,
      [busId]
    );

    const nowIso = new Date().toISOString();

    if (activeTrip) {
      await query(
        `UPDATE trips SET status = 'on_the_way', direction = ?, route_id = ?, driver_id = ?, last_ping_time = ? WHERE id = ?`,
        [direction, routeId, driverId, nowIso, activeTrip.id]
      );
    } else {
      const tripId = `trip-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      await query(
        `INSERT INTO trips (id, bus_id, route_id, driver_id, direction, status, start_time, last_ping_time)
         VALUES (?, ?, ?, ?, ?, 'on_the_way', ?, ?)`,
        [tripId, busId, routeId, driverId, direction, nowIso, nowIso]
      );
      activeTrip = await get('SELECT * FROM trips WHERE id = ?', [tripId]);
    }

    await query("UPDATE buses SET status = 'on_trip', route_id = ?, driver_id = ? WHERE id = ?", [routeId, driverId, busId]);

    const io = getIo();
    if (io) {
      io.to(`route:${routeId}`).emit('trip:started', { trip: activeTrip, direction });
      io.to('global').emit('trip:started', { trip: activeTrip, direction });
    }

    res.status(201).json({ success: true, trip: activeTrip });
  } catch (err) {
    console.error('[TRIPS] Start error:', err);
    res.status(500).json({ error: 'Failed to start trip' });
  }
});

// Driver: Location Update (HTTP endpoint)
router.post('/location', async (req, res) => {
  try {
    const { tripId, busId, latitude, longitude, speed, heading, timestamp } = req.body;
    if (!tripId || !busId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'tripId, busId, latitude, and longitude are required' });
    }

    const telemetry = await processLocationUpdate({
      tripId,
      busId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: parseFloat(speed || 0),
      heading: parseFloat(heading || 0),
      timestamp
    });

    res.json({ success: true, data: telemetry });
  } catch (err) {
    console.error('[TRIPS] Location update error:', err);
    res.status(500).json({ error: 'Failed to process location update' });
  }
});

// Driver: Batch Location Flush (offline queue)
router.post('/batch-location', async (req, res) => {
  try {
    const { updates } = req.body; // Array of updates
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array is required' });
    }

    let latest = null;
    for (const item of updates) {
      latest = await processLocationUpdate({
        tripId: item.tripId,
        busId: item.busId,
        latitude: parseFloat(item.latitude),
        longitude: parseFloat(item.longitude),
        speed: parseFloat(item.speed || 0),
        heading: parseFloat(item.heading || 0),
        timestamp: item.timestamp
      });
    }

    res.json({ success: true, processed: updates.length, latest });
  } catch (err) {
    console.error('[TRIPS] Batch location error:', err);
    res.status(500).json({ error: 'Failed to process batch updates' });
  }
});

// Driver: Quick Status Update
router.post('/status', async (req, res) => {
  try {
    const { tripId, busId, status, note } = req.body;
    let mappedStatus = 'on_the_way';
    if (status === 'delayed' || status === 'breakdown') {
      mappedStatus = status;
    }

    await query(
      'UPDATE trips SET status = ?, last_status_note = ? WHERE id = ?',
      [mappedStatus, note || status, tripId]
    );

    const trip = await get('SELECT * FROM trips WHERE id = ?', [tripId]);

    const io = getIo();
    if (io && trip) {
      const updateEvent = {
        tripId,
        busId,
        routeId: trip.route_id,
        status: mappedStatus,
        note: note || status,
        timestamp: new Date().toISOString()
      };
      io.to(`route:${trip.route_id}`).emit('bus:status_changed', updateEvent);
      io.to('global').emit('bus:status_changed', updateEvent);
    }

    res.json({ success: true, status: mappedStatus });
  } catch (err) {
    console.error('[TRIPS] Status update error:', err);
    res.status(500).json({ error: 'Failed to update trip status' });
  }
});

// Driver: End Trip
router.post('/end', async (req, res) => {
  try {
    const { tripId, busId } = req.body;
    const nowIso = new Date().toISOString();

    await query("UPDATE trips SET status = 'arrived', end_time = ? WHERE id = ?", [nowIso, tripId]);
    await query("UPDATE buses SET status = 'idle' WHERE id = ?", [busId]);

    const trip = await get('SELECT * FROM trips WHERE id = ?', [tripId]);

    const io = getIo();
    if (io && trip) {
      io.to(`route:${trip.route_id}`).emit('trip:ended', { tripId, busId, routeId: trip.route_id });
      io.to('global').emit('trip:ended', { tripId, busId, routeId: trip.route_id });
    }

    res.json({ success: true, message: 'Trip ended successfully' });
  } catch (err) {
    console.error('[TRIPS] End trip error:', err);
    res.status(500).json({ error: 'Failed to end trip' });
  }
});

// GET location history trail for trip
router.get('/history/:tripId', async (req, res) => {
  try {
    const updates = await all(
      'SELECT latitude, longitude, speed, heading, timestamp FROM location_updates WHERE trip_id = ? ORDER BY timestamp ASC',
      [req.params.tripId]
    );
    res.json({ success: true, count: updates.length, updates });
  } catch (err) {
    console.error('[TRIPS] History error:', err);
    res.status(500).json({ error: 'Failed to fetch trip history' });
  }
});

module.exports = router;
