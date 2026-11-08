import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { offlineQueue } from '../utils/offlineQueue';
import { formatDistance, formatETA } from '../utils/geo';
import {
  Play,
  Square,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Navigation,
  Gauge,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  ShieldAlert,
  Car
} from 'lucide-react';

export default function DriverApp() {
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();

  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [direction, setDirection] = useState('morning'); // 'morning' | 'evening'

  const [isTripActive, setIsTripActive] = useState(false);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [routeStops, setRouteStops] = useState([]);

  // Telemetry state
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [nextStop, setNextStop] = useState(null);
  const [nextStopEta, setNextStopEta] = useState(0);
  const [statusNote, setStatusNote] = useState('');
  const [queuedCount, setQueuedCount] = useState(offlineQueue.count());
  const [gpsSimIndex, setGpsSimIndex] = useState(0);
  const [gpsSource, setGpsSource] = useState('device'); // 'device' | 'simulator'

  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const simIntervalRef = useRef(null);

  // Fetch buses & routes
  useEffect(() => {
    async function loadMeta() {
      try {
        const [bRes, rRes] = await Promise.all([
          fetch('/api/buses'),
          fetch('/api/routes')
        ]);
        const bData = await bRes.json();
        const rData = await rRes.json();

        if (bData.buses) {
          setBuses(bData.buses);
          // Auto-select bus assigned to this driver if any
          const myBus = bData.buses.find(b => b.driver_id === user?.id) || bData.buses[0];
          if (myBus) {
            setSelectedBusId(myBus.id);
            if (myBus.route_id) setSelectedRouteId(myBus.route_id);
          }
        }

        if (rData.routes) {
          setRoutes(rData.routes);
        }
      } catch (err) {
        console.error('Error loading driver meta:', err);
      }
    }
    loadMeta();
  }, [user]);

  // Load stops for selected route
  useEffect(() => {
    if (!selectedRouteId) return;
    fetch(`/api/routes/${selectedRouteId}`)
      .then(res => res.json())
      .then(data => {
        if (data.stops) setRouteStops(data.stops);
      })
      .catch(console.error);
  }, [selectedRouteId]);

  // Screen Wake Lock API to prevent phone screen from turning off while driving
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[DRIVER] Screen Wake Lock acquired.');
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[DRIVER] Wake Lock released.');
        });
      } catch (err) {
        console.warn('[DRIVER] Wake Lock error:', err.message);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Start Trip
  const handleStartTrip = async () => {
    if (!selectedBusId || !selectedRouteId) {
      alert('Please select a bus and route first.');
      return;
    }

    try {
      const res = await fetch('/api/trips/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: selectedBusId,
          routeId: selectedRouteId,
          driverId: user?.id || 'user-drv-1',
          direction
        })
      });

      const data = await res.json();
      if (data.trip) {
        setCurrentTrip(data.trip);
        setIsTripActive(true);
        requestWakeLock();
        startGPSLocationStream(data.trip.id);
      }
    } catch (err) {
      console.error('Start trip error:', err);
      alert('Failed to start trip: ' + err.message);
    }
  };

  // End Trip
  const handleEndTrip = async () => {
    if (!currentTrip) return;
    if (!window.confirm('Are you sure you want to end this trip?')) return;

    try {
      await fetch('/api/trips/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: currentTrip.id,
          busId: selectedBusId
        })
      });

      stopGPSLocationStream();
      releaseWakeLock();
      setIsTripActive(false);
      setCurrentTrip(null);
      setCurrentSpeed(0);
      setNextStop(null);
    } catch (err) {
      console.error('End trip error:', err);
    }
  };

  // Quick Status Updates
  const handleStatusUpdate = async (status, note) => {
    if (!currentTrip) return;

    try {
      setStatusNote(note || status);
      await fetch('/api/trips/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: currentTrip.id,
          busId: selectedBusId,
          status,
          note: note || status
        })
      });
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  // Broadcast or Queue GPS update
  const sendLocationPing = (lat, lng, speed = 0, heading = 0) => {
    const payload = {
      tripId: currentTrip?.id,
      busId: selectedBusId,
      latitude: lat,
      longitude: lng,
      speed: Math.round(speed),
      heading: Math.round(heading),
      timestamp: new Date().toISOString()
    };

    setCurrentCoords({ lat, lng });
    setCurrentSpeed(Math.round(speed));

    if (isConnected && socket) {
      socket.emit('driver:location_update', payload, (res) => {
        if (res?.data) {
          if (res.data.nextStop) setNextStop(res.data.nextStop);
          if (res.data.nextStopEtaMinutes !== undefined) setNextStopEta(res.data.nextStopEtaMinutes);
        }
      });
    } else {
      // Offline: queue update locally!
      offlineQueue.add(payload);
      setQueuedCount(offlineQueue.count());
    }
  };

  // Start GPS Stream
  const startGPSLocationStream = (tripId) => {
    // 1. If physical device GPS available
    if ('geolocation' in navigator && gpsSource === 'device') {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const speed = (pos.coords.speed || 0) * 3.6; // convert m/s to km/h
          const heading = pos.coords.heading || 0;
          sendLocationPing(lat, lng, speed, heading);
        },
        (err) => {
          console.warn('[GPS] Device GPS error or denied. Switching to test route waypoints:', err.message);
          startWaypointSimulator();
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      startWaypointSimulator();
    }
  };

  // Waypoint Simulator for testing driver mode without driving physically
  const startWaypointSimulator = () => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    if (!routeStops || routeStops.length === 0) return;

    let idx = 0;
    const ordered = direction === 'evening' ? [...routeStops].reverse() : [...routeStops];

    simIntervalRef.current = setInterval(() => {
      const stop = ordered[idx % ordered.length];
      const nextS = ordered[(idx + 1) % ordered.length];
      const jitterLat = stop.latitude + (Math.random() - 0.5) * 0.001;
      const jitterLng = stop.longitude + (Math.random() - 0.5) * 0.001;
      const simSpeed = 35 + Math.floor(Math.random() * 10);

      sendLocationPing(jitterLat, jitterLng, simSpeed, 45);
      idx++;
    }, 3500);
  };

  const stopGPSLocationStream = () => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  };

  // Auto flush queue when reconnecting
  useEffect(() => {
    if (isConnected) {
      offlineQueue.flush(async (items) => {
        if (socket) socket.emit('driver:batch_location_update', items);
      }).then(() => setQueuedCount(0));
    }
  }, [isConnected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopGPSLocationStream();
      releaseWakeLock();
    };
  }, []);

  const selectedBus = buses.find(b => b.id === selectedBusId);
  const selectedRoute = routes.find(r => r.id === selectedRouteId);

  return (
    <div className="max-w-xl mx-auto p-3.5 sm:p-5 space-y-4">
      {/* Driver Cockpit Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Driver Console</span>
          <h2 className="text-xl font-black text-white">{user?.name || 'College Bus Driver'}</h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Phone: <span className="text-slate-200">{user?.phone || '+91 98451 12233'}</span>
          </div>
        </div>

        {/* Network & Offline Queue Pill */}
        <div className="text-right">
          <div className="flex items-center space-x-1.5 justify-end">
            {isConnected ? (
              <span className="flex items-center text-emerald-400 text-xs font-bold">
                <Wifi className="w-3.5 h-3.5 mr-1" />
                Live
              </span>
            ) : (
              <span className="flex items-center text-amber-400 text-xs font-bold animate-pulse">
                <WifiOff className="w-3.5 h-3.5 mr-1" />
                Offline
              </span>
            )}
          </div>
          {queuedCount > 0 && (
            <div className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full mt-1 border border-amber-500/20">
              {queuedCount} pings buffered
            </div>
          )}
        </div>
      </div>

      {/* Bus & Route Selection (disabled while trip active) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Select Bus</label>
            <select
              disabled={isTripActive}
              value={selectedBusId}
              onChange={(e) => {
                setSelectedBusId(e.target.value);
                const b = buses.find(item => item.id === e.target.value);
                if (b?.route_id) setSelectedRouteId(b.route_id);
              }}
              className="w-full bg-slate-800 text-white font-bold text-xs rounded-xl p-2.5 border border-slate-700 disabled:opacity-50"
            >
              {buses.map(b => (
                <option key={b.id} value={b.id}>
                  {b.bus_number} ({b.registration_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Select Route</label>
            <select
              disabled={isTripActive}
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full bg-slate-800 text-white font-bold text-xs rounded-xl p-2.5 border border-slate-700 disabled:opacity-50"
            >
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Direction Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Trip Direction</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isTripActive}
              onClick={() => setDirection('morning')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition ${
                direction === 'morning'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
              } disabled:opacity-50`}
            >
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Morning (Home to College)</span>
            </button>

            <button
              type="button"
              disabled={isTripActive}
              onClick={() => setDirection('evening')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition ${
                direction === 'evening'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
              } disabled:opacity-50`}
            >
              <Moon className="w-4 h-4 text-indigo-400" />
              <span>Evening (College to Home)</span>
            </button>
          </div>
        </div>

        {/* GPS Mode Toggle for Test/Demo */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-400">GPS Source:</span>
          <div className="flex items-center space-x-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              disabled={isTripActive}
              onClick={() => setGpsSource('device')}
              className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                gpsSource === 'device' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              Phone GPS
            </button>
            <button
              type="button"
              disabled={isTripActive}
              onClick={() => setGpsSource('simulator')}
              className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                gpsSource === 'simulator' ? 'bg-amber-600 text-white' : 'text-slate-400'
              }`}
            >
              Test Route GPS
            </button>
          </div>
        </div>
      </div>

      {/* Primary Trip Action Button: Start / End */}
      <div>
        {!isTripActive ? (
          <button
            onClick={handleStartTrip}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-lg shadow-xl shadow-emerald-900/40 flex items-center justify-center space-x-2 transition active:scale-98"
          >
            <Play className="w-6 h-6 fill-white" />
            <span>START TRIP NOW</span>
          </button>
        ) : (
          <button
            onClick={handleEndTrip}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-black text-lg shadow-xl shadow-rose-900/40 flex items-center justify-center space-x-2 transition active:scale-98 animate-pulse"
          >
            <Square className="w-6 h-6 fill-white" />
            <span>END TRIP</span>
          </button>
        )}
      </div>

      {/* Live Dashboard (Active when trip started) */}
      {isTripActive && (
        <div className="space-y-4">
          {/* Real-time Telemetry Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                <Gauge className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400">Live Speed</div>
                <div className="text-2xl font-black text-white">{currentSpeed} <span className="text-sm font-bold text-slate-400">km/h</span></div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400">Next Stop ETA</div>
                <div className="text-2xl font-black text-white">~{nextStopEta || 2} <span className="text-sm font-bold text-slate-400">min</span></div>
              </div>
            </div>
          </div>

          {/* Next Stop Card */}
          <div className="bg-gradient-to-r from-blue-950/80 to-slate-900 border border-blue-500/30 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping mr-1" />
                Approaching Next Stop
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                {currentCoords ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}` : 'GPS active'}
              </span>
            </div>
            <div className="text-xl font-black text-white mt-1">
              {nextStop ? nextStop.name : routeStops[0]?.name || 'Next Scheduled Stop'}
            </div>
            {nextStop?.landmark && (
              <div className="text-xs text-blue-200 mt-0.5">
                📍 {nextStop.landmark}
              </div>
            )}
          </div>

          {/* Quick Incident & Status Report Buttons */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Quick Status Broadcast (Notifies Students & Transport Office)
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                onClick={() => handleStatusUpdate('delayed', 'Heavy Rain / Bad Weather')}
                className="p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex flex-col items-center justify-center space-y-1 transition active:scale-95"
              >
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold">Delayed</span>
              </button>

              <button
                onClick={() => handleStatusUpdate('delayed', 'Severe Traffic Jam')}
                className="p-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/30 flex flex-col items-center justify-center space-y-1 transition active:scale-95"
              >
                <Car className="w-5 h-5 text-orange-400" />
                <span className="text-xs font-bold">Traffic Jam</span>
              </button>

              <button
                onClick={() => handleStatusUpdate('breakdown', 'Mechanical Breakdown / Puncture')}
                className="p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex flex-col items-center justify-center space-y-1 transition active:scale-95"
              >
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                <span className="text-xs font-bold">Breakdown</span>
              </button>

              <button
                onClick={() => handleStatusUpdate('on_the_way', 'Normal / Back on Track')}
                className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex flex-col items-center justify-center space-y-1 transition active:scale-95"
              >
                <Clock className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold">On Schedule</span>
              </button>
            </div>

            {statusNote && (
              <div className="mt-2.5 text-xs text-slate-300 bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
                Last reported: <b>{statusNote}</b>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
