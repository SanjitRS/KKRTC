/**
 * Road Routing Service using OSRM (Open Source Routing Machine)
 * Fetches turn-by-turn road geometry adhering strictly to actual streets, highways, and turns.
 */

const https = require('https');

const roadGeometryCache = new Map();

/**
 * Fetch true road polyline from OSRM for a list of coordinates
 * @param {Array<{latitude: number, longitude: number}>} stops 
 * @returns {Promise<Array<[number, number]>>} Array of [lat, lng] coordinates along real roads
 */
async function fetchRoadGeometry(stops) {
  if (!stops || stops.length < 2) return [];

  // Generate cache key
  const cacheKey = stops.map(s => `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`).join(';');
  if (roadGeometryCache.has(cacheKey)) {
    return roadGeometryCache.get(cacheKey);
  }

  // OSRM expects coordinates in lng,lat format separated by semicolons
  const coordString = stops.map(s => `${s.longitude},${s.latitude}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const rawData = await new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': 'NITTEBusTracker/1.0 (NMIT Yelahanka Bengaluru Bus Route Tracker)'
          },
          timeout: 8000
        },
        (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => resolve(data));
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OSRM request timed out'));
      });
    });

    const parsed = JSON.parse(rawData);

    if (parsed.code === 'Ok' && parsed.routes && parsed.routes.length > 0) {
      const geoCoordinates = parsed.routes[0].geometry.coordinates;
      // OSRM returns [lng, lat], convert to Leaflet standard [lat, lng]
      const roadCoords = geoCoordinates.map(([lng, lat]) => [lat, lng]);

      console.log(`[ROUTER] Loaded ${roadCoords.length} road geometry points from OSRM.`);
      roadGeometryCache.set(cacheKey, roadCoords);
      return roadCoords;
    }
  } catch (err) {
    console.warn('[ROUTER] OSRM fetch failed, falling back to segment points:', err.message);
  }

  // Fallback: return direct stop coordinates
  const fallbackCoords = stops.map(s => [s.latitude, s.longitude]);
  return fallbackCoords;
}

module.exports = {
  fetchRoadGeometry
};
