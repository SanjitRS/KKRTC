import React, { useEffect, useState, useRef } from 'react';
import { Bell, BellRing, Check, Volume2 } from 'lucide-react';

export default function NotificationHandler({
  trip,
  studentStop,
  route
}) {
  const [permission, setPermission] = useState('default');
  const [alertHistory, setAlertHistory] = useState({ tenMinFired: false, twoMinFired: false, currentTripId: null });
  const [activeAlertToast, setActiveAlertToast] = useState(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop/push notifications');
      return;
    }
    try {
      const status = await Notification.requestPermission();
      setPermission(status);
      if (status === 'granted') {
        new Notification('NITTE Bus Alerts Enabled! 🚍', {
          body: 'You will receive alerts when your bus is ~10 min and ~2 min away from your stop.',
          icon: '/bus-icon-192.png'
        });
      }
    } catch (e) {
      console.warn('Notification permission error:', e);
    }
  };

  // Sound chime synthesizer using Web Audio API (no external sound file required!)
  const playChime = (urgent = false) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = urgent ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(urgent ? 880 : 587.33, audioCtx.currentTime); // A5 or D5
      osc.frequency.exponentialRampToValueAtTime(urgent ? 1174.66 : 880, audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      // AudioContext might be blocked until user gesture
    }
  };

  // Monitor ETA for 10 min and 2 min triggers
  useEffect(() => {
    if (!trip || !studentStop || !trip.stopETAs) return;

    const stopTelemetry = trip.stopETAs[studentStop.id];
    if (!stopTelemetry) return;

    const eta = stopTelemetry.etaMinutes;
    const tripId = trip.id;

    // Reset flags if trip changed
    if (alertHistory.currentTripId !== tripId) {
      setAlertHistory({ tenMinFired: false, twoMinFired: false, currentTripId: tripId });
      return;
    }

    // 10 Min Alert Trigger
    if (eta <= 10 && eta > 2 && !alertHistory.tenMinFired && !stopTelemetry.isPassed) {
      const title = '🚍 College Bus ~10 Minutes Away!';
      const body = `Bus ${trip.bus_number || ''} is approaching ${studentStop.name}. ETA: ~${eta} mins.`;

      playChime(false);
      setActiveAlertToast({ title, body, type: 'warning' });

      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/bus-icon-192.png' });
      }

      setAlertHistory(prev => ({ ...prev, tenMinFired: true }));
    }

    // 2 Min Alert Trigger
    if (eta <= 2 && eta > 0 && !alertHistory.twoMinFired && !stopTelemetry.isPassed) {
      const title = '⚡ Bus Arriving in ~2 Minutes!';
      const body = `Bus ${trip.bus_number || ''} is almost at ${studentStop.name}! Head to your boarding stop now.`;

      playChime(true);
      setActiveAlertToast({ title, body, type: 'urgent' });

      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/bus-icon-192.png' });
      }

      setAlertHistory(prev => ({ ...prev, twoMinFired: true }));
    }
  }, [trip, studentStop, alertHistory]);

  return (
    <>
      {/* Alert Permission Pill in Header or Bar */}
      <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs">
        <div className="flex items-center space-x-2">
          {permission === 'granted' ? (
            <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
              <BellRing className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="p-1 rounded-lg bg-slate-700 text-slate-400">
              <Bell className="w-3.5 h-3.5" />
            </div>
          )}
          <div>
            <span className="font-semibold text-white">Arrival Push Alerts</span>
            <span className="text-[11px] text-slate-400 block">
              {permission === 'granted' ? 'Active: alerts at 10m & 2m' : 'Get notified before bus arrives'}
            </span>
          </div>
        </div>

        {permission !== 'granted' ? (
          <button
            onClick={requestPermission}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs transition active:scale-95"
          >
            Enable
          </button>
        ) : (
          <span className="text-emerald-400 font-bold flex items-center space-x-1">
            <Check className="w-3.5 h-3.5" />
            <span>Enabled</span>
          </span>
        )}
      </div>

      {/* Floating In-App Arrival Toast */}
      {activeAlertToast && (
        <div className="fixed top-16 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 bg-gradient-to-r from-blue-900 to-indigo-900 border-2 border-blue-400/80 rounded-2xl p-4 shadow-2xl animate-bounce">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🔔</span>
              <div>
                <h4 className="font-black text-white text-sm">{activeAlertToast.title}</h4>
                <p className="text-xs text-blue-200 mt-0.5">{activeAlertToast.body}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveAlertToast(null)}
              className="text-white/80 hover:text-white text-xs font-bold px-2 py-1 rounded-lg bg-white/10"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
