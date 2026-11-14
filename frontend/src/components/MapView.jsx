import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Compass, Crosshair, MapPin } from 'lucide-react';

/**
 * Advanced OpenStreetMap Leaflet Map Component
 * Inspired by SanjitRS/BMTC (OsmMapView & LocationUtils):
 * - OpenStreetMap Mapnik tiles
 * - Geofence Safe Zone circle around student's boarding stop with arrival halo
 * - Find My style animated bus marker with heading indicator and live speed
 * - Tap-to-coordinate pin placement for admin stop creation
 * - Smooth camera panning and recentering without layer flicker
 */
export default function MapView({
  stops = [],
  buses = [],
  roadGeometry = [],
  selectedStopId = null,
  routeColor = '#2563EB',
  onMapClick = null,
  newPinLocation = null,
  centerOnBus = false,
  className = 'h-full w-full'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const geofenceLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const tempPinLayerRef = useRef(null);
  const busMarkersMapRef = useRef(new Map());

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center around NMIT Yelahanka Bengaluru Campus (13.12939, 77.58790)
      const map = L.map(mapContainerRef.current, {
        center: [13.12939, 77.58790],
        zoom: 12.5,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap Mapnik Tile Layer (Free, OSM standard)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Dedicated overlay layers
      geofenceLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      tempPinLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Ensure Leaflet recalculates dimensions when container resizes
      let resizeObserver = null;
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      // Handle map tap for coordinate picking
      map.on('click', (e) => {
        if (onMapClick) {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      });

      return () => {
        if (resizeObserver) resizeObserver.disconnect();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, []);

  // Update map click handler
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.off('click');
    if (onMapClick) {
      mapInstanceRef.current.on('click', (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }
  }, [onMapClick]);

  // Update Temp Pin for Admin
  useEffect(() => {
    if (!tempPinLayerRef.current) return;
    tempPinLayerRef.current.clearLayers();

    if (newPinLocation) {
      const pinIcon = L.divIcon({
        className: 'custom-pin-marker',
        html: `
          <div style="background-color: #ef4444; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.5);">
            <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      L.marker([newPinLocation.lat, newPinLocation.lng], { icon: pinIcon })
        .addTo(tempPinLayerRef.current)
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #0f172a;">
            <b>Selected Location Pin</b><br/>
            Lat: <code>${newPinLocation.lat.toFixed(5)}</code><br/>
            Lng: <code>${newPinLocation.lng.toFixed(5)}</code>
          </div>
        `)
        .openPopup();
    }
  }, [newPinLocation]);

  // Draw Geofence Zone, Route Polyline, and Stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !routeLayerRef.current || !geofenceLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    routeLayerRef.current.clearLayers();
    geofenceLayerRef.current.clearLayers();

    const polylineCoords = [];
    const selectedStop = stops.find(s => s.id === selectedStopId);

    // 1. Geofence Zone around Student's Boarding Stop (BMTC style GeofenceZone)
    if (selectedStop && selectedStop.latitude && selectedStop.longitude) {
      // Check if bus is inside geofence (within 500m)
      const primaryBus = buses.find(b => b.current_latitude && b.current_longitude);
      let isInsideGeofence = false;

      if (primaryBus) {
        const dLat = (primaryBus.current_latitude - selectedStop.latitude) * 111.32;
        const dLon = (primaryBus.current_longitude - selectedStop.longitude) * 111.32 * Math.cos(selectedStop.latitude * Math.PI / 180);
        const distMeters = Math.sqrt(dLat * dLat + dLon * dLon) * 1000;
        if (distMeters <= 500) {
          isInsideGeofence = true;
        }
      }

      const strokeColor = isInsideGeofence ? '#10b981' : '#f59e0b';
      const fillColor = isInsideGeofence ? 'rgba(16, 185, 129, 0.22)' : 'rgba(245, 158, 11, 0.16)';

      L.circle([selectedStop.latitude, selectedStop.longitude], {
        radius: 450, // 450 meters geofence radius
        color: strokeColor,
        weight: 2.5,
        dashArray: isInsideGeofence ? null : '6, 6',
        fillColor: fillColor,
        fillOpacity: 0.8
      })
      .bindTooltip(
        isInsideGeofence ? '⚡ Bus arrived in Geofence Safe Zone!' : `🎯 ${selectedStop.name} (450m Geofence)`,
        { permanent: false, direction: 'top', className: 'geofence-tooltip' }
      )
      .addTo(geofenceLayerRef.current);
    }

    // 2. Draw Stops along the Route
    stops.forEach((stop, idx) => {
      if (!stop.latitude || !stop.longitude) return;

      polylineCoords.push([stop.latitude, stop.longitude]);

      const isMyBoardingStop = stop.id === selectedStopId;
      const isPassed = stop.isPassed;
      const isApproaching = stop.isApproaching;

      let bgColor = isPassed ? '#64748b' : '#3b82f6';
      let ringHtml = '';

      if (isMyBoardingStop) {
        bgColor = '#eab308'; // Golden star for user's stop
        ringHtml = `<div style="position: absolute; inset: -7px; border: 2.5px dashed #facc15; border-radius: 50%; animation: spin 8s linear infinite;"></div>`;
      } else if (isApproaching) {
        bgColor = '#06b6d4'; // Cyan for next approaching stop
        ringHtml = `<div style="position: absolute; inset: -6px; border: 2px solid #06b6d4; border-radius: 50%; opacity: 0.8;" class="animate-ping"></div>`;
      }

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
            ${ringHtml}
            <div style="background-color: ${bgColor}; width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid #0f172a; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.45);">
              ${isMyBoardingStop ? '★' : idx + 1}
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const popupContent = `
        <div style="font-family: sans-serif; min-width: 180px; color: #0f172a; padding: 2px;">
          <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: ${isMyBoardingStop ? '#b45309' : '#64748b'};">
            ${isMyBoardingStop ? '⭐ YOUR BOARDING STOP' : `STOP #${idx + 1}`}
          </div>
          <div style="font-size: 14px; font-weight: 700; margin-top: 2px;">${stop.name}</div>
          ${stop.landmark ? `<div style="font-size: 11px; color: #475569; margin-top: 1px;">📍 ${stop.landmark}</div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <span>Morning: <b>${stop.scheduled_time_morning || '--'}</b></span>
            <span>Evening: <b>${stop.scheduled_time_evening || '--'}</b></span>
          </div>
          ${stop.etaMinutes !== undefined && !isPassed ? `
            <div style="margin-top: 6px; background: #eff6ff; color: #1d4ed8; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; text-align: center;">
              Arriving in ~${stop.etaMinutes} min (${stop.distanceKm || 0} km)
            </div>
          ` : ''}
        </div>
      `;

      L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
        .addTo(markersLayerRef.current)
        .bindPopup(popupContent);
    });

    // 3. Draw Route Polyline along real roads (Double Layer: Glow + Crisp Track)
    const pointsToDraw = (roadGeometry && roadGeometry.length > 1) ? roadGeometry : polylineCoords;
    if (pointsToDraw.length > 1) {
      // Glow underlay
      L.polyline(pointsToDraw, {
        color: routeColor,
        weight: 6,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayerRef.current);

      // Crisp track line following exact roads
      L.polyline(pointsToDraw, {
        color: routeColor,
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayerRef.current);
    }

    // Initial fit if not done yet
    if (pointsToDraw.length > 0 && !map._hasInitialFit) {
      map.fitBounds(L.latLngBounds(pointsToDraw), { padding: [40, 40] });
      map._hasInitialFit = true;
    }
  }, [stops, roadGeometry, selectedStopId, routeColor]);

  // Update Buses without full map re-render (smooth position updates inspired by BMTC OsmMapView)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    buses.forEach((bus) => {
      const lat = bus.current_latitude;
      const lng = bus.current_longitude;
      if (!lat || !lng) return;

      const heading = bus.heading || 0;
      const speed = bus.current_speed || 0;
      const status = bus.status || bus.trip_status || 'on_the_way';

      let statusColor = '#3b82f6';
      let ringColor = 'rgba(59, 130, 246, 0.4)';
      if (status === 'delayed') {
        statusColor = '#f59e0b';
        ringColor = 'rgba(245, 158, 11, 0.4)';
      } else if (status === 'breakdown') {
        statusColor = '#ef4444';
        ringColor = 'rgba(239, 68, 68, 0.4)';
      } else if (status === 'offline') {
        statusColor = '#64748b';
        ringColor = 'transparent';
      }

      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: -4px; border-radius: 50%; background-color: ${ringColor};" class="bus-pulse-ring"></div>
            <div style="width: 40px; height: 40px; background-color: #090d16; border: 2.5px solid ${statusColor}; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(0,0,0,0.65); position: relative;">
              <svg style="transform: rotate(${heading}deg); transition: transform 0.4s ease;" width="20" height="20" viewBox="0 0 24 24" fill="${statusColor}">
                <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
              </svg>
              <span style="font-size: 8px; font-weight: 800; color: white; margin-top: -1px; letter-spacing: -0.5px;">${bus.bus_number ? bus.bus_number.replace('Bus ', 'B') : 'BUS'}</span>
            </div>
          </div>
        `,
        iconSize: [46, 46],
        iconAnchor: [23, 23]
      });

      const popupContent = `
        <div style="font-family: sans-serif; min-width: 190px; color: #0f172a;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <b style="font-size: 14px;">🚍 ${bus.bus_number}</b>
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; background: ${statusColor}22; color: ${statusColor}; padding: 2px 6px; border-radius: 9999px;">
              ${status.replace('_', ' ')}
            </span>
          </div>
          <div style="font-size: 11px; color: #475569;">Reg: <b>${bus.registration_number}</b></div>
          <div style="font-size: 11px; color: #475569;">Driver: <b>${bus.driver_name || 'Assigned Driver'}</b></div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 11px; display: flex; justify-content: space-between;">
            <span>Speed: <b>${speed} km/h</b></span>
            <span>Next: <b>${bus.next_stop_name || 'En Route'}</b></span>
          </div>
        </div>
      `;

      if (busMarkersMapRef.current.has(bus.id)) {
        const marker = busMarkersMapRef.current.get(bus.id);
        marker.setLatLng([lat, lng]);
        marker.setIcon(busIcon);
        marker.setPopupContent(popupContent);
      } else {
        const marker = L.marker([lat, lng], { icon: busIcon })
          .addTo(map)
          .bindPopup(popupContent);
        busMarkersMapRef.current.set(bus.id, marker);
      }
    });

    // Remove old buses not in list
    const currentBusIds = new Set(buses.map(b => b.id));
    for (const [id, marker] of busMarkersMapRef.current.entries()) {
      if (!currentBusIds.has(id)) {
        marker.remove();
        busMarkersMapRef.current.delete(id);
      }
    }

    // Auto-center camera if requested
    if (centerOnBus && buses.length > 0 && buses[0].current_latitude) {
      map.panTo([buses[0].current_latitude, buses[0].current_longitude], { animate: true, duration: 1 });
    }
  }, [buses, centerOnBus]);

  // Map Controls
  const fitRouteBounds = () => {
    if (!mapInstanceRef.current || stops.length === 0) return;
    const coords = stops.map(s => [s.latitude, s.longitude]).filter(c => c[0] && c[1]);
    if (coords.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(coords), { padding: [40, 40], animate: true });
    }
  };

  const focusBus = () => {
    if (!mapInstanceRef.current || buses.length === 0) return;
    const b = buses[0];
    if (b && b.current_latitude && b.current_longitude) {
      mapInstanceRef.current.setView([b.current_latitude, b.current_longitude], 15, { animate: true });
    }
  };

  const focusMyStop = () => {
    if (!mapInstanceRef.current || !selectedStopId) return;
    const stop = stops.find(s => s.id === selectedStopId);
    if (stop && stop.latitude && stop.longitude) {
      mapInstanceRef.current.setView([stop.latitude, stop.longitude], 15, { animate: true });
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Action Controls */}
      <div className="absolute right-3.5 top-20 z-[1000] flex flex-col space-y-2">
        {buses.length > 0 && buses[0].current_latitude && (
          <button
            onClick={focusBus}
            className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-blue-400 border border-slate-700/80 shadow-xl flex items-center justify-center transition active:scale-95 backdrop-blur-md"
            title="Recenter on live bus"
          >
            <Crosshair className="w-5 h-5 text-blue-400" />
          </button>
        )}

        {selectedStopId && (
          <button
            onClick={focusMyStop}
            className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-700/80 shadow-xl flex items-center justify-center transition active:scale-95 backdrop-blur-md"
            title="Focus on my boarding stop"
          >
            <MapPin className="w-5 h-5 text-amber-400" />
          </button>
        )}

        <button
          onClick={fitRouteBounds}
          className="w-10 h-10 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 shadow-xl flex items-center justify-center transition active:scale-95 backdrop-blur-md"
          title="Fit full route"
        >
          <Compass className="w-5 h-5 text-slate-300" />
        </button>
      </div>
    </div>
  );
}
