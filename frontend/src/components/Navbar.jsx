import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Bus, Wifi, WifiOff, User, Navigation, LogOut, ChevronDown } from 'lucide-react';

export default function Navbar({ onOpenLogin, activeTab, setActiveTab }) {
  const { user, role, demoLogin, logout } = useAuth();
  const { isConnected } = useSocket();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 py-2.5 sm:px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">NITTE</span>
              <span className="font-semibold text-xs sm:text-sm text-blue-400">Bus Tracker</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                PWA
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
              {isConnected ? (
                <span className="flex items-center text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                  Live GPS
                </span>
              ) : (
                <span className="flex items-center text-amber-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1" />
                  Connecting
                </span>
              )}
              <span>•</span>
              <span className="truncate max-w-[120px] sm:max-w-none text-slate-300">
                {user ? user.name : 'Guest'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Role Switcher Pills */}
        <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => {
              if (role !== 'student') demoLogin('student');
              if (setActiveTab) setActiveTab('student');
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 ${
              role === 'student'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Switch to Student view"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Student</span>
          </button>

          <button
            onClick={() => {
              if (role !== 'driver') demoLogin('driver');
              if (setActiveTab) setActiveTab('driver');
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 ${
              role === 'driver'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Switch to Driver view"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Driver</span>
          </button>
        </div>

        {/* User Account / Auth Actions */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onOpenLogin}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60"
            title="Account / Switch user"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
