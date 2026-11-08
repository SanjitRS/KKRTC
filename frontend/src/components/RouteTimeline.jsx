import React from 'react';
import { CheckCircle2, Circle, Star, Clock, MapPin } from 'lucide-react';

export default function RouteTimeline({
  stops = [],
  trip = null,
  selectedStopId = null,
  direction = 'morning',
  onSelectStop = null
}) {
  const isMorning = direction === 'morning';

  // Order stops according to direction
  const orderedStops = isMorning ? [...stops] : [...stops].reverse();

  // Calculate crossed progress percentage
  const totalStops = orderedStops.length;
  const passedCount = orderedStops.filter(s => s.isPassed).length;
  const progressPercent = totalStops > 0 ? Math.round((passedCount / totalStops) * 100) : 0;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl">
      {/* Header & Progress */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center space-x-2">
            <span>Route Stops & Progress</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
              {totalStops} Stops
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isMorning ? 'Home to NMIT Yelahanka Campus' : 'NMIT Yelahanka Campus to Home'}
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold text-blue-400">{progressPercent}% Completed</span>
          <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-3 mt-4 relative max-h-[320px] overflow-y-auto pr-1">
        {orderedStops.map((stop, index) => {
          const isMyStop = stop.id === selectedStopId;
          const isPassed = stop.isPassed;
          const isApproaching = stop.isApproaching;
          const scheduledTime = isMorning ? stop.scheduled_time_morning : stop.scheduled_time_evening;
          const eta = stop.etaMinutes;

          return (
            <div
              key={stop.id || index}
              onClick={() => onSelectStop && onSelectStop(stop)}
              className={`flex items-start space-x-3 p-2.5 rounded-xl transition-all cursor-pointer border ${
                isMyStop
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                  : isApproaching
                  ? 'bg-blue-500/10 border-blue-500/40 shadow-sm'
                  : 'bg-slate-800/30 border-slate-800/60 hover:bg-slate-800/60'
              }`}
            >
              {/* Timeline Indicator */}
              <div className="flex flex-col items-center pt-0.5">
                {isPassed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : isApproaching ? (
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
                  </div>
                ) : isMyStop ? (
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-500" />
                )}
              </div>

              {/* Stop Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-sm font-bold truncate ${isMyStop ? 'text-amber-300' : isPassed ? 'text-slate-400 line-through' : 'text-white'}`}>
                    {stop.name}
                  </span>

                  {isMyStop && (
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                      My Stop
                    </span>
                  )}
                  {isApproaching && !isPassed && (
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse flex-shrink-0">
                      Next Stop
                    </span>
                  )}
                </div>

                {stop.landmark && (
                  <div className="text-[11px] text-slate-400 truncate flex items-center space-x-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    <span>{stop.landmark}</span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-1.5 text-xs">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Sched: <b className="text-slate-300">{scheduledTime || '--'}</b></span>
                  </span>

                  {!isPassed && eta !== undefined && eta > 0 && (
                    <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                      ETA ~{eta} min ({stop.distanceKm || 0} km)
                    </span>
                  )}

                  {isPassed && (
                    <span className="text-[11px] font-semibold text-emerald-400">
                      Crossed
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
