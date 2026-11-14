import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Radio, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import {
  playNammaMetroChime,
  playNammaMetroStopAnnouncement,
  STOP_KANNADA_MAP
} from '../utils/nammaMetroAudio';

export default function NammaMetroAnnouncement({ nextStop, isApproachingStudentStop = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [kannadaToggle, setKannadaToggle] = useState(true);
  const lastAnnouncedStopIdRef = useRef(null);

  // Auto-switch between Kannada and English display every 3.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setKannadaToggle(prev => !prev);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Trigger announcement whenever nextStop changes
  useEffect(() => {
    if (!nextStop || !nextStop.id) return;

    // Check if we should auto-announce
    if (lastAnnouncedStopIdRef.current !== nextStop.id) {
      lastAnnouncedStopIdRef.current = nextStop.id;

      if (!isMuted) {
        handlePlayAnnouncement(nextStop);
      }
    }
  }, [nextStop?.id, isMuted]);

  const handlePlayAnnouncement = async (stopToAnnounce = nextStop) => {
    if (!stopToAnnounce) return;
    setIsPlaying(true);
    const isTerminus = stopToAnnounce.id === 'stop-nmit-campus';

    await playNammaMetroStopAnnouncement(stopToAnnounce, {
      isTerminus,
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false)
    });
    setIsPlaying(false);
  };

  const currentStop = nextStop || {
    id: 'stop-r19-4',
    name: 'Dairy Circle (Mother Dairy)'
  };
  const mapping = STOP_KANNADA_MAP[currentStop.id] || {
    kn: currentStop.name,
    en: currentStop.name
  };

  return (
    <div className="w-full select-none">
      <div className={`overflow-hidden rounded-2xl border transition-all duration-300 shadow-xl backdrop-blur-md ${
        isPlaying
          ? 'bg-purple-950/90 border-purple-500/80 shadow-purple-900/40 ring-1 ring-purple-400/50'
          : 'bg-slate-900/90 border-slate-700/80 shadow-slate-950/50'
      }`}>
        {/* Glowing Top Line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-purple-500 via-emerald-400 to-indigo-500" />

        {/* Compact Single-Row Floating Bar */}
        <div className="px-3 py-1.5 flex items-center justify-between gap-2">
          {/* Left: Station Info */}
          <div className="flex items-center space-x-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isPlaying ? 'bg-purple-600 text-white animate-pulse' : 'bg-purple-900/40 text-purple-300 border border-purple-500/30'
            }`}>
              <Radio className="w-3.5 h-3.5" />
            </div>

            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center space-x-1.5">
                <span className="text-[9px] uppercase font-extrabold px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                  Metro Voice
                </span>
                {isPlaying && (
                  <span className="text-[10px] text-emerald-400 font-bold animate-pulse">
                    Playing...
                  </span>
                )}
              </div>

              <div className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[260px]">
                {kannadaToggle ? (
                  <span className="text-emerald-300">ಮುಂದಿನ ನಿಲ್ದಾಣ: {mapping.kn}</span>
                ) : (
                  <span className="text-blue-300">Next: {mapping.en}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              onClick={() => handlePlayAnnouncement(currentStop)}
              disabled={isPlaying}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center space-x-1 shadow-sm transition active:scale-95 ${
                isPlaying
                  ? 'bg-purple-600/50 text-purple-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20'
              }`}
              title="Click to play Namma Metro chime and bilingual announcement"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isPlaying ? 'Playing' : '🔊 Chime'}</span>
            </button>

            <button
              onClick={() => setIsMuted(prev => !prev)}
              className={`p-1.5 rounded-lg border text-xs transition ${
                isMuted
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title={isMuted ? 'Unmute automatic stop announcements' : 'Mute announcements'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title={isExpanded ? 'Collapse' : 'Expand Details'}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable LED Sub-Advisory */}
        {isExpanded && (
          <div className="px-3 pb-2 pt-1 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between animate-fadeIn bg-slate-950/40">
            <span className="text-purple-300 font-medium">ದ್ವಾರಗಳು ಎಡಭಾಗದಲ್ಲಿ ತೆರೆಯುತ್ತವೆ</span>
            <span>•</span>
            <span className="text-slate-300">Doors will open on the left</span>
          </div>
        )}
      </div>
    </div>
  );
}
