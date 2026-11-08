import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Mail, Phone, Bus, MapPin, X, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onRoleSelect }) {
  const { login, register, demoLogin, user } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [usn, setUsn] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedStop, setSelectedStop] = useState('');

  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/routes')
        .then(res => res.json())
        .then(data => {
          if (data.routes) {
            setRoutes(data.routes);
            if (data.routes.length > 0) setSelectedRoute(data.routes[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedRoute) {
      fetch(`/api/routes/${selectedRoute}`)
        .then(res => res.json())
        .then(data => {
          if (data.stops) {
            setStops(data.stops);
            if (data.stops.length > 0) setSelectedStop(data.stops[0].id);
          }
        })
        .catch(console.error);
    }
  }, [selectedRoute]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register({
          name,
          email: email || undefined,
          usn: usn ? usn.toUpperCase() : undefined,
          password,
          phone,
          route_id: selectedRoute,
          stop_id: selectedStop
        });
      } else {
        await login(identifier, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = async (role, userId = null) => {
    setError('');
    setLoading(true);
    try {
      await demoLogin(role, userId);
      if (onRoleSelect) onRoleSelect(role);
      onClose();
    } catch (err) {
      setError('Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-fadeIn relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-2 text-blue-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Bus className="w-4 h-4" />
            <span>NITTE Bus Tracker</span>
          </div>
          <h2 className="text-xl font-black">
            {isRegister ? 'Student Registration' : 'Sign In to Track Bus'}
          </h2>
          <p className="text-xs text-blue-200 mt-0.5">
            {isRegister ? 'Pick your route & boarding stop to save to profile' : 'Sign in with your College Email or USN'}
          </p>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl font-semibold">
              {error}
            </div>
          )}

          {/* Quick Demo Switcher Buttons */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              ⚡ One-Click Instant Demo Login:
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoSelect('student', 'user-stu-1')}
                className="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold text-center transition active:scale-95"
              >
                🎓 Student
                <span className="block text-[9px] text-slate-400 font-normal">Sanjit R S</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSelect('driver', 'user-drv-1')}
                className="p-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold text-center transition active:scale-95"
              >
                🚍 Driver
                <span className="block text-[9px] text-slate-400 font-normal">Ramesh (B-01)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSelect('admin', 'user-admin-1')}
                className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-bold text-center transition active:scale-95"
              >
                🛡️ Admin
                <span className="block text-[9px] text-slate-400 font-normal">Transport Head</span>
              </button>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase font-bold">Or with credentials</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Login / Register Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sanjit R S"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-800 text-white rounded-xl pl-9 pr-3 py-2.5 text-xs border border-slate-700"
                  />
                </div>
              </div>
            )}

            {isRegister ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">USN</label>
                    <input
                      type="text"
                      placeholder="1NT21CS001"
                      value={usn}
                      onChange={e => setUsn(e.target.value)}
                      className="w-full bg-slate-800 text-white rounded-xl px-3 py-2 text-xs border border-slate-700 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">College Email</label>
                    <input
                      type="email"
                      placeholder="student@nmit.ac.in"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-slate-800 text-white rounded-xl px-3 py-2 text-xs border border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">My Bus Route</label>
                    <select
                      value={selectedRoute}
                      onChange={e => setSelectedRoute(e.target.value)}
                      className="w-full bg-slate-800 text-white rounded-xl px-2 py-2 text-xs border border-slate-700 font-bold truncate"
                    >
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Boarding Stop</label>
                    <select
                      value={selectedStop}
                      onChange={e => setSelectedStop(e.target.value)}
                      className="w-full bg-slate-800 text-white rounded-xl px-2 py-2 text-xs border border-slate-700 font-bold truncate"
                    >
                      {stops.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs text-slate-400 block mb-1">College Email or USN</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="1NT21CS001 or email@nmit.ac.in"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    className="w-full bg-slate-800 text-white rounded-xl pl-9 pr-3 py-2.5 text-xs border border-slate-700 font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-800 text-white rounded-xl pl-9 pr-3 py-2.5 text-xs border border-slate-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-900/40 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Processing...' : isRegister ? 'Register & Track My Bus' : 'Sign In'}
            </button>
          </form>

          {/* Toggle between Login and Register */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              {isRegister ? 'Already registered? Sign In' : "New Student? Create Account & Pick Route"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
