import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MapView from '../components/MapView';
import ETABadge from '../components/ETABadge';
import RouteTimeline from '../components/RouteTimeline';
import NoticeBanner from '../components/NoticeBanner';
import NotificationHandler from '../components/NotificationHandler';
import { Bus, MapPin, ChevronDown, ListFilter, RefreshCw } from 'lucide-react';

export default function StudentApp({ onOpenLogin }) {
  const { user, updateProfile } = useAuth();
  const { socket, joinRoute, leaveRoute, lastTelemetry, latestAnnouncement } = useSocket();

  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(user?.route_id || 'route-19');
  const [selectedStopId, setSelectedStopId] = useState(user?.stop_id || 'stop-r19-8');
  const [direction, setDirection] = useState('morning'); // 'morning' | 'evening'

  const [routeDetails, setRouteDetails] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [showStopPicker, setShowStopPicker] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [loading, setLoading] = useState(true);

  // Sync user's saved route & stop when user profile loads
  useEffect(() => {
    if (user?.route_id) {
      setSelectedRouteId(user.route_id);
    }
    if (user?.stop_id) {
      setSelectedStopId(user.stop_id);
    }
  }, [user]);

  // Fetch initial routes and announcements
  useEffect(() => {
    fetchRoutes();
    fetchAnnouncements();
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await fetch('/api/routes');
      const data = await res.json();
      if (data.routes) {
        setRoutes(data.routes);
        if (!selectedRouteId && data.routes.length > 0) {
          setSelectedRouteId(data.routes[0].id);
        }
      }
    } catch (e) {
      console.error('Fetch routes error:', e);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch(`/api/announcements?routeId=${selectedRouteId || ''}`);
      const data = await res.json();
      if (data.announcements) setAnnouncements(data.announcements);
    } catch (e) {}
  };

  // Fetch route details and active trip whenever selectedRouteId changes
  useEffect(() => {
    if (!selectedRouteId) return;

    joinRoute(selectedRouteId);
    loadRouteData(selectedRouteId);

    return () => {
      leaveRoute(selectedRouteId);
    };
  }, [selectedRouteId]);

  const loadRouteData = async (routeId) => {
    setLoading(true);
    try {
      // 1. Route details & stops
      const rRes = await fetch(`/api/routes/${routeId}`);
      const rData = await rRes.json();
      if (rData.route) {
        setRouteDetails(rData);

        // If no stop selected for this route, pick a default stop
        if (!selectedStopId && rData.stops && rData.stops.length > 0) {
          const defaultStop = rData.stops[Math.floor(rData.stops.length / 2)] || rData.stops[0];
          setSelectedStopId(defaultStop.id);
        }
      }

      // 2. Active trip for this route
      const tRes = await fetch(`/api/trips/route/${routeId}`);
      const tData = await tRes.json();
      if (tData.trip) {
        setActiveTrip(tData.trip);
        if (tData.trip.direction) {
          setDirection(tData.trip.direction);
        }
      } else {
        setActiveTrip(null);
      }
    } catch (err) {
      console.error('Error loading route data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle incoming live telemetry over Socket.IO
  useEffect(() => {
    if (!lastTelemetry) return;
    if (lastTelemetry.route?.id === selectedRouteId || lastTelemetry.bus?.route_id === selectedRouteId) {
      setActiveTrip(prev => ({
        ...prev,
        ...lastTelemetry,
        id: lastTelemetry.tripId,
        current_latitude: lastTelemetry.latitude,
        current_longitude: lastTelemetry.longitude,
        current_speed: lastTelemetry.speed,
        heading: lastTelemetry.heading,
        status: lastTelemetry.status,
        stopETAs: lastTelemetry.stopETAs,
        passedStopIds: lastTelemetry.passedStopIds,
        next_stop_name: lastTelemetry.nextStop?.name,
        direction: lastTelemetry.direction || direction
      }));
    }
  }, [lastTelemetry, selectedRouteId]);

  // Handle new incoming announcement
  useEffect(() => {
    if (!latestAnnouncement) return;
    if (!latestAnnouncement.route_id || latestAnnouncement.route_id === selectedRouteId) {
      setAnnouncements(prev => [latestAnnouncement, ...prev]);
    }
  }, [latestAnnouncement, selectedRouteId]);

  // Socket event listeners for trip start/end and status changes
  useEffect(() => {
    if (!socket) return;

    const handleTripStarted = (data) => {
      if (data.trip?.route_id === selectedRouteId) {
        setActiveTrip(data.trip);
        if (data.direction) setDirection(data.direction);
      }
    };

    const handleTripEnded = (data) => {
      if (data.routeId === selectedRouteId) {
        setActiveTrip(prev => (prev ? { ...prev, status: 'arrived' } : null));
      }
    };

    const handleStatusChanged = (data) => {
      if (data.routeId === selectedRouteId) {
        setActiveTrip(prev => (prev ? { ...prev, status: data.status, last_status_note: data.note } : null));
      }
    };

    const handleOffline = (data) => {
      if (data.routeId === selectedRouteId) {
        setActiveTrip(prev => (prev ? { ...prev, status: 'offline' } : null));
      }
    };

    socket.on('trip:started', handleTripStarted);
    socket.on('trip:ended', handleTripEnded);
    socket.on('bus:status_changed', handleStatusChanged);
    socket.on('bus:offline', handleOffline);

    return () => {
      socket.off('trip:started', handleTripStarted);
      socket.off('trip:ended', handleTripEnded);
      socket.off('bus:status_changed', handleStatusChanged);
      socket.off('bus:offline', handleOffline);
    };
  }, [socket, selectedRouteId]);

  // Handle stop selection and save to user profile
  const handleSelectBoardingStop = async (stop) => {
    setSelectedStopId(stop.id);
    setShowStopPicker(false);
    if (user) {
      await updateProfile({ route_id: selectedRouteId, stop_id: stop.id });
    }
  };

  // Handle route change
  const handleRouteChange = async (routeId) => {
    setSelectedRouteId(routeId);
    setShowStopPicker(false);
    if (user) {
      await updateProfile({ route_id: routeId });
    }
  };

  const studentStop = routeDetails?.stops?.find(s => s.id === selectedStopId) || null;
  const currentRoute = routes.find(r => r.id === selectedRouteId) || routeDetails?.route;

  // Prepare enriched stops with ETA and passed flags
  const enrichedStops = (routeDetails?.stops || []).map((stop, idx) => {
    const isPassed = activeTrip?.passedStopIds?.includes(stop.id);
    const stopEta = activeTrip?.stopETAs?.[stop.id];
    const isApproaching = activeTrip?.nextStop?.id === stop.id || (!isPassed && idx === 0 && activeTrip?.status === 'on_the_way');

    return {
      ...stop,
      isPassed: Boolean(isPassed),
      isApproaching: Boolean(isApproaching),
      etaMinutes: stopEta?.etaMinutes,
      distanceKm: stopEta?.distanceKm
    };
  });

  // Active buses on this route for Map
  const activeBuses = activeTrip ? [activeTrip] : (routeDetails?.buses || []);

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] max-w-7xl mx-auto w-full relative">
      {/* Top Floating Bar: Route Selector & Notification Permission */}
      <div className="p-3 bg-slate-900/95 border-b border-slate-800 z-20 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Route Switcher Dropdown */}
          <div className="relative flex-1">
            <select
              value={selectedRouteId}
              onChange={(e) => handleRouteChange(e.target.value)}
              className="w-full bg-slate-800 hover:bg-slate-700/80 text-white font-bold text-xs sm:text-sm rounded-xl px-3 py-2 border border-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer truncate pr-8"
            >
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Boarding Stop Picker Button */}
          <button
            onClick={() => setShowStopPicker(!showStopPicker)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex-shrink-0"
            title="Choose boarding stop"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span className="max-w-[100px] sm:max-w-[150px] truncate">
              {studentStop ? studentStop.name : 'Select Stop'}
            </span>
          </button>
        </div>

        {/* Announcements Banner */}
        <NoticeBanner announcements={announcements} />

        {/* Notification Alert Prompt */}
        <NotificationHandler
          trip={activeTrip}
          studentStop={studentStop}
          route={currentRoute}
        />
      </div>

      {/* Stop Picker Modal / Dropdown Tray */}
      {showStopPicker && (
        <div className="absolute top-28 left-3 right-3 z-30 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 max-h-80 overflow-y-auto animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
            <span className="font-extrabold text-sm text-white flex items-center space-x-1.5">
              <span>Pick Your Boarding Stop</span>
            </span>
            <button
              onClick={() => setShowStopPicker(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800"
            >
              Close
            </button>
          </div>
          <div className="space-y-1.5">
            {(routeDetails?.stops || []).map((s, idx) => (
              <div
                key={s.id}
                onClick={() => handleSelectBoardingStop(s)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                  s.id === selectedStopId
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'bg-slate-800/40 hover:bg-slate-800 text-slate-200 border border-slate-700/40 text-xs'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-[10px] flex items-center justify-center font-bold text-slate-300">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="text-sm">{s.name}</div>
                    {s.landmark && <div className="text-[11px] text-slate-400">📍 {s.landmark}</div>}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <div>Morning: <b className="text-slate-300">{s.scheduled_time_morning || '--'}</b></div>
                  <div>Evening: <b className="text-slate-300">{s.scheduled_time_evening || '--'}</b></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        <MapView
          stops={enrichedStops}
          buses={activeBuses}
          roadGeometry={routeDetails?.road_geometry || []}
          selectedStopId={selectedStopId}
          routeColor={currentRoute?.color || '#2563EB'}
          centerOnBus={Boolean(activeTrip?.current_latitude)}
        />

        {/* Movable & Collapsible Floating ETA Badge */}
        <div className="absolute left-3 right-3 bottom-3 z-[1000] pointer-events-none max-w-xl mx-auto flex justify-center">
          <div className="pointer-events-auto w-full">
            <ETABadge
              bus={activeTrip?.bus || routeDetails?.buses?.[0]}
              trip={activeTrip}
              studentStop={studentStop}
              direction={direction}
              onDirectionToggle={(d) => setDirection(d)}
              onOpenRoutePicker={() => setShowStopPicker(true)}
            />
          </div>
        </div>
      </div>

      {/* Expandable Route Timeline Section */}
      <div className="bg-slate-900 border-t border-slate-800 p-3 max-h-56 overflow-y-auto">
        <RouteTimeline
          stops={enrichedStops}
          trip={activeTrip}
          selectedStopId={selectedStopId}
          direction={direction}
          onSelectStop={(s) => handleSelectBoardingStop(s)}
        />
      </div>
    </div>
  );
}
