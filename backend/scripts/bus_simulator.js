/**
 * NITTE Bus Tracker - Road-Accurate GPS Bus Simulator
 * 
 * Simulates college buses moving strictly along actual Bengaluru streets,
 * highways, curves, and turns using OSRM turn-by-turn road geometry.
 * 
 * Usage:
 *   node scripts/bus_simulator.js          (Simulates Bus 01 on Route 1 along Bellary Rd to NMIT)
 *   node scripts/bus_simulator.js --all    (Simulates all 5 buses concurrently along roads)
 *   node scripts/bus_simulator.js --bus=3  (Simulates Bus 03 on Route 2 along ORR)
 */

const { io } = require('socket.io-client');
const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL, { reconnection: true });

// Parse command line arguments
const args = process.argv.slice(2);
const simulateAll = args.includes('--all');
const busArg = args.find(a => a.startsWith('--bus='));
const targetBusIndex = busArg ? parseInt(busArg.split('=')[1], 10) : 1;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Fetch helper
function fetchJson(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`${BACKEND_URL}${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function postJson(urlPath, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(`${BACKEND_URL}${urlPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Convert OSRM road geometry into precise road waypoints
function generateRoadWaypoints(roadGeometry, fallbackStops) {
  if (roadGeometry && roadGeometry.length > 2) {
    const waypoints = [];
    for (let i = 0; i < roadGeometry.length - 1; i++) {
      const [lat1, lng1] = roadGeometry[i];
      const [lat2, lng2] = roadGeometry[i + 1];
      const hdg = bearing(lat1, lng1, lat2, lng2);
      waypoints.push({
        latitude: lat1,
        longitude: lng1,
        heading: Math.round(hdg)
      });
    }
    const last = roadGeometry[roadGeometry.length - 1];
    waypoints.push({
      latitude: last[0],
      longitude: last[1],
      heading: waypoints[waypoints.length - 1]?.heading || 0
    });
    return waypoints;
  }

  // Fallback if no road geometry
  const waypoints = [];
  for (let i = 0; i < fallbackStops.length - 1; i++) {
    const p1 = fallbackStops[i];
    const p2 = fallbackStops[i + 1];
    for (let step = 0; step < 10; step++) {
      const fraction = step / 10;
      const lat = p1.latitude + fraction * (p2.latitude - p1.latitude);
      const lng = p1.longitude + fraction * (p2.longitude - p1.longitude);
      const hdg = bearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      waypoints.push({ latitude: lat, longitude: lng, heading: Math.round(hdg) });
    }
  }
  return waypoints;
}

class RoadBusSimulatorAgent {
  constructor(bus, route, stops, roadGeometry, direction = 'morning') {
    this.bus = bus;
    this.route = route;
    this.direction = direction;
    this.stops = stops;
    this.roadGeometry = roadGeometry;
    
    // Reverse geometry for evening trip
    const activeRoadPoints = direction === 'evening'
      ? [...roadGeometry].reverse()
      : roadGeometry;

    this.waypoints = generateRoadWaypoints(activeRoadPoints, stops);
    this.currentIndex = 0;
    this.tripId = null;
    this.timer = null;
    this.speed = 38 + Math.floor(Math.random() * 8); // 38-46 km/h
  }

  async start() {
    console.log(`[SIM] 🛣️ Starting road-accurate trip for ${this.bus.bus_number} on ${this.route.name} (${this.direction})...`);
    console.log(`[SIM] Loaded ${this.waypoints.length} road coordinates adhering strictly to Bengaluru roads.`);

    const startRes = await postJson('/api/trips/start', {
      busId: this.bus.id,
      routeId: this.route.id,
      driverId: this.bus.driver_id || 'user-drv-1',
      direction: this.direction
    });

    if (startRes && startRes.trip) {
      this.tripId = startRes.trip.id;
      console.log(`[SIM] Trip active: ${this.tripId} for ${this.bus.bus_number}`);
    } else {
      console.error(`[SIM] Could not start trip for ${this.bus.bus_number}`);
      return;
    }

    // Step every 2.5 seconds along the road
    this.timer = setInterval(() => this.step(), 2500);
  }

  step() {
    if (this.currentIndex >= this.waypoints.length) {
      // Reached terminus, reverse direction
      console.log(`[SIM] 🏁 ${this.bus.bus_number} arrived at terminus! Switching direction...`);
      this.direction = this.direction === 'morning' ? 'evening' : 'morning';
      const reversedPoints = [...this.roadGeometry].reverse();
      this.waypoints = generateRoadWaypoints(reversedPoints, this.stops);
      this.currentIndex = 0;
      return;
    }

    const pt = this.waypoints[this.currentIndex];
    const currentSpeed = Math.max(25, Math.min(50, this.speed + (Math.random() * 4 - 2)));

    const payload = {
      tripId: this.tripId,
      busId: this.bus.id,
      latitude: pt.latitude,
      longitude: pt.longitude,
      speed: Math.round(currentSpeed),
      heading: pt.heading,
      timestamp: new Date().toISOString()
    };

    socket.emit('driver:location_update', payload, (res) => {
      if (res?.data) {
        const next = res.data.nextStop ? res.data.nextStop.name : 'En route';
        const eta = res.data.nextStopEtaMinutes;
        console.log(`[SIM] 🚍 ${this.bus.bus_number} | Road Coord: ${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)} | Heading: ${pt.heading}° | Speed: ${Math.round(currentSpeed)} km/h | Next: ${next} (~${eta}m)`);
      }
    });

    // Advance along the road points
    // Advance by 3 points so speed represents ~35-45 km/h along the fine-grained road points
    this.currentIndex += 3;
    if (this.currentIndex >= this.waypoints.length && this.waypoints.length > 0) {
      this.currentIndex = this.waypoints.length - 1;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

async function run() {
  console.log(`=======================================================`);
  console.log(`🚍 NMIT Bengaluru Bus Fleet - Real Road GPS Simulator`);
  console.log(`📡 Connecting to backend at: ${BACKEND_URL}`);
  console.log(`=======================================================`);

  socket.on('connect', async () => {
    console.log(`[SIM] Connected to Socket.IO tracking server.`);

    try {
      const busesRes = await fetchJson('/api/buses');
      const routesRes = await fetchJson('/api/routes');

      const buses = busesRes.buses || [];
      const routes = routesRes.routes || [];

      if (buses.length === 0 || routes.length === 0) {
        console.error('[SIM] No buses or routes found. Run `npm run seed` first.');
        process.exit(1);
      }

      const activeSimulators = [];

      let busesToSimulate = [];
      if (simulateAll) {
        busesToSimulate = buses;
        console.log(`[SIM] Simulating ALL ${buses.length} buses simultaneously along Bengaluru roads!`);
      } else {
        const selected = buses[targetBusIndex - 1] || buses[0];
        busesToSimulate = [selected];
        console.log(`[SIM] Simulating selected bus: ${selected.bus_number} (${selected.registration_number})`);
      }

      for (const bus of busesToSimulate) {
        const route = routes.find(r => r.id === bus.route_id) || routes[0];
        // Fetch route details which includes road_geometry from OSRM!
        const routeDetails = await fetchJson(`/api/routes/${route.id}`);
        const stops = routeDetails.stops || [];
        const roadGeometry = routeDetails.road_geometry || [];

        if (stops.length > 0) {
          const sim = new RoadBusSimulatorAgent(bus, route, stops, roadGeometry, 'morning');
          activeSimulators.push(sim);
          await sim.start();
        }
      }

      process.on('SIGINT', () => {
        console.log('\n[SIM] Stopping road simulators...');
        activeSimulators.forEach(s => s.stop());
        socket.disconnect();
        process.exit(0);
      });

    } catch (err) {
      console.error('[SIM] Initialization failed:', err.message);
      process.exit(1);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('[SIM] Socket error:', err.message);
  });
}

run();
