/**
 * ETA, Distance, and Route Progression Calculator for NITTE Bus Tracker
 */

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates great-circle distance between two coordinates using the Haversine formula
 * @returns {number} distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates bearing/heading angle between two points in degrees (0 - 360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Evaluates bus progression along the ordered stops of a route for a given trip direction.
 * In 'morning' direction, order is 1 -> N (Home to College).
 * In 'evening' direction, order is reversed N -> 1 (College to Home).
 * 
 * @param {Array} orderedStops Array of stop objects with { id, latitude, longitude, stop_order, name }
 * @param {number} busLat Current bus latitude
 * @param {number} busLng Current bus longitude
 * @param {number} currentSpeed Current bus speed in km/h
 * @param {string} direction 'morning' | 'evening'
 * @returns {Object} progression state, ETAs for each stop, nextStop, crossedStops
 */
function calculateRouteProgression(orderedStops, busLat, busLng, currentSpeed = 30, direction = 'morning') {
  if (!orderedStops || orderedStops.length === 0) {
    return {
      nextStop: null,
      passedStopIds: [],
      stopETAs: {},
      totalDistanceRemainingKm: 0,
      effectiveSpeedKmh: 30
    };
  }

  // Work with ordered array according to direction
  const routeSequence = direction === 'evening'
    ? [...orderedStops].reverse()
    : [...orderedStops];

  // Effective speed smoothed: if stopped (speed < 5 km/h), assume typical moving speed of 30 km/h for ETA
  // Clamp realistic college bus speed between 15 km/h and 55 km/h
  let effectiveSpeed = currentSpeed;
  if (!effectiveSpeed || effectiveSpeed < 5) {
    effectiveSpeed = 28; // default realistic speed when stopped at a signal or boarding
  } else if (effectiveSpeed > 60) {
    effectiveSpeed = 50;
  }

  // Find the closest segment or stop along the sequence
  // We check distance from bus to each stop
  let minDistanceToStop = Infinity;
  let closestStopIndex = 0;

  for (let i = 0; i < routeSequence.length; i++) {
    const s = routeSequence[i];
    const dist = haversineDistance(busLat, busLng, s.latitude, s.longitude);
    if (dist < minDistanceToStop) {
      minDistanceToStop = dist;
      closestStopIndex = i;
    }
  }

  // Determine current active leg:
  // If the bus is very close to a stop (< 150m), it's at that stop.
  // Otherwise, determine if it has passed closestStopIndex or approaching it.
  // To be robust: If closestStop is index 0 and bus is near start, nextStop is index 1 (or index 0 if not started).
  let nextStopIndex = closestStopIndex;
  
  // If bus is within 120 meters of closest stop, and not at final terminus, advance to next
  if (minDistanceToStop < 0.12 && closestStopIndex < routeSequence.length - 1) {
    nextStopIndex = closestStopIndex + 1;
  } else if (closestStopIndex < routeSequence.length - 1) {
    // Check if bus is moving away from closestStop towards the next stop
    const distToNext = haversineDistance(busLat, busLng, routeSequence[closestStopIndex + 1].latitude, routeSequence[closestStopIndex + 1].longitude);
    const stopToNextDist = haversineDistance(
      routeSequence[closestStopIndex].latitude,
      routeSequence[closestStopIndex].longitude,
      routeSequence[closestStopIndex + 1].latitude,
      routeSequence[closestStopIndex + 1].longitude
    );
    // If distance from bus to next is less than segment length, bus is between closest and next
    if (distToNext < stopToNextDist) {
      nextStopIndex = closestStopIndex + 1;
    }
  }

  const passedStopIds = [];
  for (let i = 0; i < nextStopIndex; i++) {
    passedStopIds.push(routeSequence[i].id);
  }

  const stopETAs = {};
  let accumulatedDistance = 0;

  // Distance to nextStop
  if (nextStopIndex < routeSequence.length) {
    const distToNext = haversineDistance(
      busLat,
      busLng,
      routeSequence[nextStopIndex].latitude,
      routeSequence[nextStopIndex].longitude
    );
    accumulatedDistance = distToNext;

    // Calculate ETA for nextStop
    const nextEtaMin = Math.max(1, Math.round((accumulatedDistance / effectiveSpeed) * 60));
    stopETAs[routeSequence[nextStopIndex].id] = {
      etaMinutes: nextEtaMin,
      distanceKm: parseFloat(accumulatedDistance.toFixed(1)),
      status: 'approaching',
      isPassed: false
    };

    // Calculate ETAs for subsequent stops along sequence
    for (let j = nextStopIndex + 1; j < routeSequence.length; j++) {
      const segDist = haversineDistance(
        routeSequence[j - 1].latitude,
        routeSequence[j - 1].longitude,
        routeSequence[j].latitude,
        routeSequence[j].longitude
      );
      accumulatedDistance += segDist;
      const etaMin = Math.max(1, Math.round((accumulatedDistance / effectiveSpeed) * 60));

      stopETAs[routeSequence[j].id] = {
        etaMinutes: etaMin,
        distanceKm: parseFloat(accumulatedDistance.toFixed(1)),
        status: 'upcoming',
        isPassed: false
      };
    }
  }

  // Mark passed stops
  for (let k = 0; k < nextStopIndex; k++) {
    stopETAs[routeSequence[k].id] = {
      etaMinutes: 0,
      distanceKm: 0,
      status: 'passed',
      isPassed: true
    };
  }

  const nextStop = nextStopIndex < routeSequence.length ? routeSequence[nextStopIndex] : null;

  return {
    nextStop,
    nextStopEtaMinutes: nextStop && stopETAs[nextStop.id] ? stopETAs[nextStop.id].etaMinutes : 0,
    passedStopIds,
    stopETAs,
    totalDistanceRemainingKm: parseFloat(accumulatedDistance.toFixed(1)),
    effectiveSpeedKmh: Math.round(effectiveSpeed)
  };
}

module.exports = {
  haversineDistance,
  calculateBearing,
  calculateRouteProgression
};
