import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import MapView from '../components/MapView';
import {
  Bus,
  MapPin,
  Route as RouteIcon,
  Users,
  Megaphone,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Radio,
  AlertTriangle,
  RefreshCw,
  Send
} from 'lucide-react';

export default function AdminPanel() {
  const { socket, lastTelemetry } = useSocket();

  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' | 'routes' | 'buses' | 'announcements'
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);

  // Modals / Form states
  const [showAddBusModal, setShowAddBusModal] = useState(false);
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // New Stop Form with Map Pin Placement
  const [newStopForm, setNewStopForm] = useState({
    name: '',
    landmark: '',
    latitude: '',
    longitude: ''
  });
  const [pinLocation, setPinLocation] = useState(null);

  // New Bus Form
  const [busForm, setBusForm] = useState({
    bus_number: '',
    registration_number: '',
    capacity: 52,
    route_id: '',
    driver_id: ''
  });

  // Announcement Form
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    category: 'general',
    priority: 'normal',
    route_id: ''
  });

  // Route Form
  const [routeForm, setRouteForm] = useState({
    name: '',
    code: '',
    start_location: '',
    end_location: '',
    color: '#2563EB'
  });

  // Load all initial data
  useEffect(() => {
    refreshAllData();
  }, []);

  const refreshAllData = async () => {
    try {
      const [bRes, rRes, sRes, dRes, aRes, tRes] = await Promise.all([
        fetch('/api/buses'),
        fetch('/api/routes'),
        fetch('/api/routes/stops/all'),
        fetch('/api/buses/meta/drivers'),
        fetch('/api/announcements'),
        fetch('/api/trips/active')
      ]);

      const [bData, rData, sData, dData, aData, tData] = await Promise.all([
        bRes.json(),
        rRes.json(),
        sRes.json(),
        dRes.json(),
        aRes.json(),
        tRes.json()
      ]);

      if (bData.buses) setBuses(bData.buses);
      if (rData.routes) setRoutes(rData.routes);
      if (sData.stops) setStops(sData.stops);
      if (dData.drivers) setDrivers(dData.drivers);
      if (aData.announcements) setAnnouncements(aData.announcements);
      if (tData.trips) setActiveTrips(tData.trips);
    } catch (err) {
      console.error('Error refreshing admin data:', err);
    }
  };

  // Sync incoming telemetry from Socket.IO onto the live fleet
  useEffect(() => {
    if (!lastTelemetry) return;
    setActiveTrips(prev => {
      const idx = prev.findIndex(t => t.id === lastTelemetry.tripId || t.bus_id === lastTelemetry.busId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          current_latitude: lastTelemetry.latitude,
          current_longitude: lastTelemetry.longitude,
          current_speed: lastTelemetry.speed,
          heading: lastTelemetry.heading,
          status: lastTelemetry.status,
          next_stop_name: lastTelemetry.nextStop?.name
        };
        return copy;
      } else {
        return [lastTelemetry, ...prev];
      }
    });
  }, [lastTelemetry]);

  // Click on map to place pin
  const handleMapPinDrop = (lat, lng) => {
    setPinLocation({ lat, lng });
    setNewStopForm(prev => ({
      ...prev,
      latitude: lat.toFixed(5),
      longitude: lng.toFixed(5)
    }));
  };

  // Create Stop
  const handleCreateStop = async (e) => {
    e.preventDefault();
    if (!newStopForm.name || !newStopForm.latitude || !newStopForm.longitude) {
      alert('Name, latitude, and longitude are required.');
      return;
    }

    try {
      const res = await fetch('/api/routes/stops/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStopForm)
      });
      const data = await res.json();
      if (data.stop) {
        setShowAddStopModal(false);
        setNewStopForm({ name: '', landmark: '', latitude: '', longitude: '' });
        setPinLocation(null);
        refreshAllData();
      }
    } catch (err) {
      alert('Error creating stop: ' + err.message);
    }
  };

  // Create Bus
  const handleCreateBus = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(busForm)
      });
      const data = await res.json();
      if (data.bus) {
        setShowAddBusModal(false);
        setBusForm({ bus_number: '', registration_number: '', capacity: 52, route_id: '', driver_id: '' });
        refreshAllData();
      }
    } catch (err) {
      alert('Error creating bus: ' + err.message);
    }
  };

  // Update Bus Assignment
  const handleUpdateBusAssignment = async (busId, routeId, driverId) => {
    try {
      await fetch(`/api/buses/${busId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: routeId, driver_id: driverId })
      });
      refreshAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Post Announcement
  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...announcementForm,
          route_id: announcementForm.route_id || null
        })
      });
      const data = await res.json();
      if (data.announcement) {
        setShowBroadcastModal(false);
        setAnnouncementForm({ title: '', message: '', category: 'general', priority: 'normal', route_id: '' });
        refreshAllData();
      }
    } catch (err) {
      alert('Error broadcasting announcement: ' + err.message);
    }
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (id) => {
    try {
      await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      refreshAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // All active and idle buses combined for the map
  const fleetBuses = buses.map(b => {
    const active = activeTrips.find(t => t.bus_id === b.id);
    return active ? { ...b, ...active } : b;
  });

  return (
    <div className="max-w-7xl mx-auto p-3.5 sm:p-5 space-y-4">
      {/* Top Bar with Stats & Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Transport Office</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Admin Console
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-0.5">NITTE Fleet Management</h1>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setShowBroadcastModal(true)}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/30 flex items-center justify-center space-x-1.5 transition active:scale-95"
            >
              <Megaphone className="w-4 h-4" />
              <span>Broadcast Notice</span>
            </button>

            <button
              onClick={refreshAllData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[11px] font-semibold text-slate-400">Total Buses</div>
            <div className="text-xl font-black text-white">{buses.length}</div>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[11px] font-semibold text-emerald-400">Active On Road</div>
            <div className="text-xl font-black text-emerald-400">{activeTrips.length}</div>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[11px] font-semibold text-blue-400">Total Routes</div>
            <div className="text-xl font-black text-blue-400">{routes.length}</div>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[11px] font-semibold text-amber-400">Registered Stops</div>
            <div className="text-xl font-black text-amber-400">{stops.length}</div>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center space-x-1 mt-4 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeTab === 'fleet' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live Fleet Map</span>
          </button>

          <button
            onClick={() => setActiveTab('routes')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeTab === 'routes' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5" />
            <span>Routes & Stops</span>
          </button>

          <button
            onClick={() => setActiveTab('buses')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeTab === 'buses' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bus className="w-3.5 h-3.5" />
            <span>Buses & Drivers</span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeTab === 'announcements' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Announcements</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE FLEET MAP */}
      {activeTab === 'fleet' && (
        <div className="space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[460px] relative">
            <MapView
              stops={stops}
              buses={fleetBuses}
              routeColor="#6366f1"
              className="h-full w-full"
            />
          </div>

          {/* Active Buses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {buses.map(b => {
              const active = activeTrips.find(t => t.bus_id === b.id);
              const isMoving = active && active.status !== 'offline';

              return (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-white text-sm">{b.bus_number}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                        {b.registration_number}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 mt-1">
                      Route: <b>{b.route_name || 'Unassigned'}</b>
                    </div>
                    <div className="text-xs text-slate-400">
                      Driver: <b>{b.driver_name || 'None'}</b>
                    </div>

                    {active && (
                      <div className="mt-2 text-xs font-semibold text-blue-400">
                        Speed: {active.current_speed || 0} km/h • Next: {active.next_stop_name || 'En route'}
                      </div>
                    )}
                  </div>

                  <div>
                    {isMoving ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Idle
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ROUTES & STOPS */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Routes Column */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-sm text-white">College Routes ({routes.length})</h3>
            </div>

            <div className="space-y-2">
              {routes.map(r => (
                <div key={r.id} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400">{r.code}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {r.stops_count} stops • {r.buses_count} buses
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">{r.name}</div>
                  <div className="text-[11px] text-slate-400">
                    From: {r.start_location} → {r.end_location}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stops Column with Map Pin Placement */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-sm text-white">Stops & Pin Placement</h3>
                <p className="text-xs text-slate-400">Click anywhere on the map below to drop a pin and capture latitude/longitude</p>
              </div>
              <button
                onClick={() => setShowAddStopModal(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Pin as Stop</span>
              </button>
            </div>

            {/* Interactive Map for Pin Dropping */}
            <div className="h-64 rounded-xl overflow-hidden border border-slate-800">
              <MapView
                stops={stops}
                onMapClick={handleMapPinDrop}
                newPinLocation={pinLocation}
                className="h-full w-full"
              />
            </div>

            {pinLocation && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 flex items-center justify-between">
                <div>
                  📍 Pin dropped: Lat: <b>{pinLocation.lat.toFixed(5)}</b>, Lng: <b>{pinLocation.lng.toFixed(5)}</b>
                </div>
                <button
                  onClick={() => setShowAddStopModal(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Create Stop
                </button>
              </div>
            )}

            {/* Stops Table */}
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {stops.map(s => (
                <div key={s.id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white text-sm">{s.name}</span>
                    {s.landmark && <span className="text-slate-400 ml-2">📍 {s.landmark}</span>}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BUSES & DRIVERS */}
      {activeTab === 'buses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="font-extrabold text-sm text-white">Bus Fleet & Driver Assignments</h3>
              <p className="text-xs text-slate-400">Assign drivers to buses and buses to routes</p>
            </div>
            <button
              onClick={() => setShowAddBusModal(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bus</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 uppercase text-[10px] text-slate-400 font-bold">
                <tr>
                  <th className="p-3">Bus Number</th>
                  <th className="p-3">Registration</th>
                  <th className="p-3">Capacity</th>
                  <th className="p-3">Assigned Route</th>
                  <th className="p-3">Assigned Driver</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {buses.map(bus => (
                  <tr key={bus.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-white">{bus.bus_number}</td>
                    <td className="p-3 font-mono">{bus.registration_number}</td>
                    <td className="p-3">{bus.capacity} seats</td>
                    <td className="p-3">
                      <select
                        value={bus.route_id || ''}
                        onChange={(e) => handleUpdateBusAssignment(bus.id, e.target.value, bus.driver_id)}
                        className="bg-slate-800 text-white rounded-lg p-1.5 border border-slate-700 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {routes.map(r => (
                          <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <select
                        value={bus.driver_id || ''}
                        onChange={(e) => handleUpdateBusAssignment(bus.id, bus.route_id, e.target.value)}
                        className="bg-slate-800 text-white rounded-lg p-1.5 border border-slate-700 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {bus.status || 'idle'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="font-extrabold text-sm text-white">Broadcast Alerts & Announcements</h3>
              <p className="text-xs text-slate-400">Post notifications instantly to students on all routes or specific routes</p>
            </div>
            <button
              onClick={() => setShowBroadcastModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Announcement</span>
            </button>
          </div>

          <div className="space-y-2">
            {announcements.map(a => (
              <div key={a.id} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{a.title}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {a.category}
                    </span>
                    {a.priority === 'urgent' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{a.message}</p>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Target: <b>{a.route_name || 'All Routes'}</b> • {a.created_at}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteAnnouncement(a.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                  title="Archive announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADD STOP */}
      {showAddStopModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Add New Bus Stop</h3>
            <form onSubmit={handleCreateStop} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Stop Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Karkala Bandimutt"
                  value={newStopForm.name}
                  onChange={e => setNewStopForm({ ...newStopForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Landmark</label>
                <input
                  type="text"
                  placeholder="e.g., Near Bus Stand Clock Tower"
                  value={newStopForm.landmark}
                  onChange={e => setNewStopForm({ ...newStopForm, landmark: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newStopForm.latitude}
                    onChange={e => setNewStopForm({ ...newStopForm, latitude: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newStopForm.longitude}
                    onChange={e => setNewStopForm({ ...newStopForm, longitude: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStopModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg"
                >
                  Create Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BROADCAST ANNOUNCEMENT */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3 flex items-center space-x-2">
              <Megaphone className="w-5 h-5 text-purple-400" />
              <span>Broadcast Notice to Students</span>
            </h3>
            <form onSubmit={handlePostAnnouncement} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Heavy Rain Warning / Bajpe Route Diversion"
                  value={announcementForm.title}
                  onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Message Content</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter notice details for students..."
                  value={announcementForm.message}
                  onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Category</label>
                  <select
                    value={announcementForm.category}
                    onChange={e => setAnnouncementForm({ ...announcementForm, category: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                  >
                    <option value="general">General</option>
                    <option value="delay">Delay Alert</option>
                    <option value="route_change">Route Change</option>
                    <option value="breakdown">Breakdown</option>
                    <option value="holiday">Holiday / Fest</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Route</label>
                  <select
                    value={announcementForm.route_id}
                    onChange={e => setAnnouncementForm({ ...announcementForm, route_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                  >
                    <option value="">All Routes</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BUS */}
      {showAddBusModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Add New College Bus</h3>
            <form onSubmit={handleCreateBus} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Bus Number (Label)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Bus 06"
                  value={busForm.bus_number}
                  onChange={e => setBusForm({ ...busForm, bus_number: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Registration Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., KA-20-F-3302"
                  value={busForm.registration_number}
                  onChange={e => setBusForm({ ...busForm, registration_number: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddBusModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  Save Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
