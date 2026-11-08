const { query, get, all, getDbMode, saveSqliteToFile } = require('../config/db');
const { calculateRouteProgression, calculateBearing } = require('./etaCalculator');

let ioInstance = null;
let offlineWatchdogTimer = null;

// Cache route stops in memory for lightning fast ETA computation during GPS streaming
const routeStopsCache = new Map();

async function getRouteStops(routeId) {
  if (routeStopsCache.has(routeId)) {
    return routeStopsCache.get(routeId);
  }

  const sql = `
    SELECT rs.id as route_stop_id, rs.stop_order, rs.scheduled_time_morning, rs.scheduled_time_evening,
           s.id, s.name, s.landmark, s.latitude, s.longitude
    FROM route_stops rs
    JOIN stops s ON rs.stop_id = s.id
    WHERE rs.route_id = ?
    ORDER BY rs.stop_order ASC
  `;
  const stops = await all(sql, [routeId]);
  routeStopsCache.set(routeId, stops);
  return stops;
}

function clearRouteStopsCache(routeId = null) {
  if (routeId) {
    routeStopsCache.delete(routeId);
  } else {
    routeStopsCache.clear();
  }
}

/**
 * Handle incoming location update from a driver (or simulator)
 */
async function processLocationUpdate({ tripId, busId, latitude, longitude, speed = 0, heading = 0, timestamp = null }) {
  const trip = await get('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) {
    console.warn(`[TRACKING] Location update ignored: Trip ${tripId} not found`);
    return null;
  }

  const nowIso = timestamp || new Date().toISOString();
  const stops = await getRouteStops(trip.route_id);

  // If heading is 0 and previous coords exist, compute heading
  let calculatedHeading = heading;
  if (!calculatedHeading && trip.current_latitude && trip.current_longitude) {
    calculatedHeading = calculateBearing(
      trip.current_latitude,
      trip.current_longitude,
      latitude,
      longitude
    );
  }

  // Calculate route progression, ETAs, next stop, passed stops
  const progression = calculateRouteProgression(
    stops,
    latitude,
    longitude,
    speed,
    trip.direction || 'morning'
  );

  const nextStopId = progression.nextStop ? progression.nextStop.id : null;
  const nextStopEtaMinutes = progression.nextStopEtaMinutes || 0;

  // If status was offline or not_started, set to on_the_way
  let newStatus = trip.status;
  if (newStatus === 'offline' || newStatus === 'not_started') {
    newStatus = 'on_the_way';
  }

  // Update trip record
  await query(
    `UPDATE trips 
     SET current_latitude = ?, current_longitude = ?, current_speed = ?, heading = ?,
         next_stop_id = ?, next_stop_eta_minutes = ?, last_ping_time = ?, status = ?
     WHERE id = ?`,
    [
      latitude,
      longitude,
      speed,
      calculatedHeading,
      nextStopId,
      nextStopEtaMinutes,
      nowIso,
      newStatus,
      tripId
    ]
  );

  // Record historical location update
  const locId = `loc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  await query(
    `INSERT INTO location_updates (id, trip_id, bus_id, latitude, longitude, speed, heading, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [locId, tripId, busId, latitude, longitude, speed, calculatedHeading, nowIso]
  );

  // Fetch bus and route info for enriched broadcast
  const bus = await get('SELECT id, bus_number, registration_number, capacity FROM buses WHERE id = ?', [busId]);
  const route = await get('SELECT id, name, code, color FROM routes WHERE id = ?', [trip.route_id]);

  const telemetryPayload = {
    tripId,
    busId,
    bus,
    route,
    direction: trip.direction,
    status: newStatus,
    latitude,
    longitude,
    speed: Math.round(speed),
    heading: Math.round(calculatedHeading),
    nextStop: progression.nextStop,
    nextStopEtaMinutes,
    stopETAs: progression.stopETAs,
    passedStopIds: progression.passedStopIds,
    totalDistanceRemainingKm: progression.totalDistanceRemainingKm,
    lastPingTime: nowIso
  };

  // Broadcast to route room and global room
  if (ioInstance) {
    ioInstance.to(`route:${trip.route_id}`).emit('bus:telemetry', telemetryPayload);
    ioInstance.to('global').emit('bus:telemetry', telemetryPayload);
  }

  return telemetryPayload;
}

/**
 * Watchdog: runs every 10 seconds.
 * Marks any active bus as 'offline' if last_ping_time > 30 seconds ago.
 */
function startOfflineWatchdog() {
  if (offlineWatchdogTimer) clearInterval(offlineWatchdogTimer);

  offlineWatchdogTimer = setInterval(async () => {
    try {
      const activeTrips = await all(
        `SELECT t.*, b.bus_number, b.registration_number, r.name as route_name 
         FROM trips t
         JOIN buses b ON t.bus_id = b.id
         JOIN routes r ON t.route_id = r.id
         WHERE t.status IN ('on_the_way', 'delayed', 'breakdown')`
      );

      const now = Date.now();
      for (const trip of activeTrips) {
        if (!trip.last_ping_time) continue;

        const pingTime = new Date(trip.last_ping_time).getTime();
        const diffSeconds = (now - pingTime) / 1000;

        if (diffSeconds > 30 && trip.status !== 'offline') {
          console.log(`[WATCHDOG] Bus ${trip.bus_number} on ${trip.route_name} offline (no ping in ${Math.round(diffSeconds)}s)`);
          
          await query("UPDATE trips SET status = 'offline' WHERE id = ?", [trip.id]);
          
          if (ioInstance) {
            const offlinePayload = {
              tripId: trip.id,
              busId: trip.bus_id,
              routeId: trip.route_id,
              busNumber: trip.bus_number,
              status: 'offline',
              lastPingTime: trip.last_ping_time,
              secondsSinceLastPing: Math.round(diffSeconds)
            };
            ioInstance.to(`route:${trip.route_id}`).emit('bus:offline', offlinePayload);
            ioInstance.to('global').emit('bus:offline', offlinePayload);
          }
        }
      }
    } catch (err) {
      console.error('[WATCHDOG] Error in offline check:', err.message);
    }
  }, 10000);
}

/**
 * Setup Socket.IO server and register connection events
 */
function setupSocketIO(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // Join global room by default
    socket.join('global');

    // Subscribe to a specific route room
    socket.on('join:route', (routeId) => {
      socket.join(`route:${routeId}`);
      console.log(`[SOCKET] ${socket.id} joined room route:${routeId}`);
    });

    socket.on('leave:route', (routeId) => {
      socket.leave(`route:${routeId}`);
      console.log(`[SOCKET] ${socket.id} left room route:${routeId}`);
    });

    // Driver starts trip
    socket.on('driver:start_trip', async (payload, callback) => {
      try {
        const { busId, routeId, driverId, direction = 'morning' } = payload;
        
        // Check for any currently active trip for this bus
        let activeTrip = await get(
          `SELECT * FROM trips WHERE bus_id = ? AND status != 'arrived'`,
          [busId]
        );

        const nowIso = new Date().toISOString();

        if (activeTrip) {
          await query(
            `UPDATE trips SET status = 'on_the_way', direction = ?, route_id = ?, last_ping_time = ? WHERE id = ?`,
            [direction, routeId, nowIso, activeTrip.id]
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

        await query("UPDATE buses SET status = 'on_trip', route_id = ? WHERE id = ?", [routeId, busId]);

        io.to(`route:${routeId}`).emit('trip:started', { trip: activeTrip, direction });
        io.to('global').emit('trip:started', { trip: activeTrip, direction });

        if (callback) callback({ success: true, trip: activeTrip });
      } catch (err) {
        console.error('[SOCKET] Error in driver:start_trip:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Driver location update stream
    socket.on('driver:location_update', async (payload, callback) => {
      try {
        const result = await processLocationUpdate(payload);
        if (callback) callback({ success: true, data: result });
      } catch (err) {
        console.error('[SOCKET] Error in driver:location_update:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Driver queues batch location updates (when recovering from offline)
    socket.on('driver:batch_location_update', async (batchArray, callback) => {
      try {
        if (Array.isArray(batchArray)) {
          console.log(`[SOCKET] Processing batch of ${batchArray.length} queued location points`);
          let lastResult = null;
          for (const item of batchArray) {
            lastResult = await processLocationUpdate(item);
          }
          if (callback) callback({ success: true, processed: batchArray.length, latest: lastResult });
        }
      } catch (err) {
        console.error('[SOCKET] Error in driver:batch_location_update:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Driver quick status update: 'delayed', 'breakdown', 'traffic', 'normal'
    socket.on('driver:status_update', async (payload, callback) => {
      try {
        const { tripId, busId, status, note } = payload;
        
        let mappedStatus = 'on_the_way';
        if (status === 'delayed' || status === 'breakdown') {
          mappedStatus = status;
        }

        await query(
          'UPDATE trips SET status = ?, last_status_note = ? WHERE id = ?',
          [mappedStatus, note || status, tripId]
        );

        const trip = await get('SELECT * FROM trips WHERE id = ?', [tripId]);

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

        if (callback) callback({ success: true, status: mappedStatus });
      } catch (err) {
        console.error('[SOCKET] Error in driver:status_update:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Driver ends trip
    socket.on('driver:end_trip', async (payload, callback) => {
      try {
        const { tripId, busId } = payload;
        const nowIso = new Date().toISOString();

        await query(
          "UPDATE trips SET status = 'arrived', end_time = ? WHERE id = ?",
          [nowIso, tripId]
        );
        await query("UPDATE buses SET status = 'idle' WHERE id = ?", [busId]);

        const trip = await get('SELECT * FROM trips WHERE id = ?', [tripId]);

        io.to(`route:${trip.route_id}`).emit('trip:ended', { tripId, busId, routeId: trip.route_id });
        io.to('global').emit('trip:ended', { tripId, busId, routeId: trip.route_id });

        if (callback) callback({ success: true });
      } catch (err) {
        console.error('[SOCKET] Error in driver:end_trip:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  // Start offline watchdog
  startOfflineWatchdog();
}

function getIo() {
  return ioInstance;
}

module.exports = {
  setupSocketIO,
  getIo,
  processLocationUpdate,
  clearRouteStopsCache,
  getRouteStops
};
