import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  Navigation,
  Gauge,
  Sun,
  Moon,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Radio,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { formatDistance, formatETA } from '../utils/geo';

export default function ETABadge({
  bus,
  trip,
  studentStop,
  direction = 'morning',
  onDirectionToggle,
  onOpenRoutePicker
}) {
  const status = trip ? trip.status : 'not_started';
  const speed = trip ? (trip.current_speed || 0) : 0;
  const isMorning = direction === 'morning';

  // Movable Drag State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const badgeRef = useRef(null);

  // Calculate ETA and distance for this specific student's stop
  let etaMinutes = null;
  let distanceKm = null;
  let isPassed = false;

  if (trip && studentStop && trip.stopETAs && trip.stopETAs[studentStop.id]) {
    const stopTelemetry = trip.stopETAs[studentStop.id];
    etaMinutes = stopTelemetry.etaMinutes;
    distanceKm = stopTelemetry.distanceKm;
    isPassed = stopTelemetry.isPassed;
  }

  // Pointer Drag Handlers (supports both mouse and touch!)
  const handlePointerDown = (e) => {
    // Only drag from handle or header area
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y
    };
    e.target.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    // Constrain within viewport boundaries
    const newX = dragStartRef.current.posX + deltaX;
    const newY = dragStartRef.current.posY + deltaY;

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      e.target.releasePointerCapture?.(e.pointerId);
    }
  };

  const resetPosition = (e) => {
    e.stopPropagation();
    setPosition({ x: 0, y: 0 });
  };

  // Status Badge formatting
  const getStatusBadge = () => {
    switch (status) {
      case 'on_the_way':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>On the Way</span>
          </span>
        );
      case 'delayed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Delayed</span>
          </span>
        );
      case 'breakdown':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>Breakdown Alert</span>
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
            <span className="w-2 h-2 rounded-full bg-slate-400 mr-0.5" />
            <span>Bus Offline</span>
          </span>
        );
      case 'arrived':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <CheckCircle2 className="w-3 h-3 text-blue-400" />
            <span>Arrived</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700/60 text-slate-400 border border-slate-600/40">
            <span>Not Started</span>
          </span>
        );
    }
  };

  return (
    <div
      ref={badgeRef}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: 'none'
      }}
      className={`transition-shadow duration-200 select-none ${
        isDragging ? 'cursor-grabbing shadow-2xl ring-2 ring-blue-500/50' : 'cursor-default'
      }`}
    >
      {/* MINIMIZED PILL VIEW */}
      {isMinimized ? (
        <div
          onClick={() => setIsMinimized(false)}
          className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between space-x-3 cursor-pointer hover:bg-slate-850 active:scale-98 transition max-w-sm mx-auto"
        >
          {/* Drag Handle on Minimized */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="cursor-grab p-1 hover:bg-slate-800 rounded-lg text-slate-400"
            title="Drag to reposition"
            onClick={e => e.stopPropagation()}
          >
            <GripHorizontal className="w-4 h-4" />
          </div>

          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <div className="truncate">
              <span className="font-extrabold text-xs text-white">
                {etaMinutes !== null ? `Arriving in ${etaMinutes}m` : 'Live Bus'}
              </span>
              <span className="text-[11px] text-slate-400 block truncate">
                {studentStop ? studentStop.name : 'Boarding Stop'} {distanceKm ? `(${formatDistance(distanceKm)})` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="p-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-xs font-bold flex items-center space-x-0.5"
              title="Expand Card"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* EXPANDED FULL CARD VIEW */
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-2xl relative">
          {/* Top Drag Handle Bar */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="cursor-grab active:cursor-grabbing flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400 hover:text-slate-200 transition touch-none"
            title="Drag anywhere on map"
          >
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-400 select-none">
              <GripHorizontal className="w-4 h-4 text-blue-400" />
              <span>Drag to move</span>
            </div>

            <div className="flex items-center space-x-1">
              {(position.x !== 0 || position.y !== 0) && (
                <button
                  type="button"
                  onClick={resetPosition}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Reset to default position"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Minimize card to clear map view"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Direction toggle & Bus status */}
          <div className="flex items-center justify-between gap-2 py-2.5 border-b border-slate-800/80">
            {/* Morning / Evening Toggle */}
            <div className="flex items-center bg-slate-800/90 p-0.5 sm:p-1 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => onDirectionToggle && onDirectionToggle('morning')}
                className={`flex items-center space-x-1 px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  isMorning
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Morning</span>
              </button>

              <button
                type="button"
                onClick={() => onDirectionToggle && onDirectionToggle('evening')}
                className={`flex items-center space-x-1 px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  !isMorning
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Evening</span>
              </button>
            </div>

            <div>{getStatusBadge()}</div>
          </div>

          {/* Main ETA Hero Block */}
          <div className="py-2.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                <span>Arrival at:</span>
                <span className="text-amber-400 font-bold max-w-[170px] truncate">
                  {studentStop ? studentStop.name : 'Choose Boarding Stop'}
                </span>
              </div>

              <div className="mt-0.5">
                {status === 'not_started' ? (
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-400">
                    Scheduled:{' '}
                    <span className="text-white">
                      {studentStop
                        ? (isMorning ? studentStop.scheduled_time_morning : studentStop.scheduled_time_evening) || 'Pending'
                        : '--'}
                    </span>
                  </div>
                ) : isPassed ? (
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <span>Bus Crossed Stop</span>
                  </div>
                ) : etaMinutes !== null ? (
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-white animate-pulse-subtle">
                      Arriving in <span className="text-blue-400">{etaMinutes} min</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-300">
                    Calculating ETA...
                  </div>
                )}
              </div>
            </div>

            {/* Change Stop Shortcut */}
            <button
              type="button"
              onClick={onOpenRoutePicker}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition font-semibold flex-shrink-0"
            >
              Change Stop
            </button>
          </div>

          {/* Metrics Row: Distance, Speed, Bus Number */}
          <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800/80">
            <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-800/60 flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium">Distance</div>
                <div className="text-xs font-bold text-white truncate">
                  {distanceKm !== null ? formatDistance(distanceKm) : '--'}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-800/60 flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Gauge className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium">Speed</div>
                <div className="text-xs font-bold text-white truncate">
                  {status === 'not_started' ? '0 km/h' : `${speed} km/h`}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 rounded-xl p-2 border border-slate-800/60 flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium">Bus</div>
                <div className="text-xs font-bold text-white truncate">
                  {bus ? bus.bus_number : 'Assigned'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
