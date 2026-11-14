import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import StudentApp from './pages/StudentApp';
import DriverApp from './pages/DriverApp';
import LoginModal from './pages/LoginModal';
import { User, Navigation, Download, X } from 'lucide-react';

function MainLayout() {
  const { role, user } = useAuth();
  const [activeTab, setActiveTab] = useState('student');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Sync tab with user's role on role change
  useEffect(() => {
    if (role) {
      setActiveTab(role);
    }
  }, [role]);

  // PWA beforeinstallprompt handler
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Top Mobile Navbar */}
      <Navbar
        onOpenLogin={() => setShowLoginModal(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-4 py-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <Download className="w-4 h-4 animate-bounce" />
            <span>Install NITTE Bus Tracker App on your phone</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1 bg-white text-blue-900 rounded-lg text-xs font-extrabold hover:bg-blue-50 transition"
            >
              Install PWA
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="text-white/80 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-16 sm:pb-0">
        {activeTab === 'student' && <StudentApp onOpenLogin={() => setShowLoginModal(true)} />}
        {activeTab === 'driver' && <DriverApp />}
      </main>

      {/* Mobile Bottom Navigation Bar (Standard App Navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 sm:hidden">
        <div className="grid grid-cols-2 h-14">
          <button
            onClick={() => setActiveTab('student')}
            className={`flex flex-col items-center justify-center space-y-1 transition ${
              activeTab === 'student' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Student</span>
          </button>

          <button
            onClick={() => setActiveTab('driver')}
            className={`flex flex-col items-center justify-center space-y-1 transition ${
              activeTab === 'driver' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Navigation className="w-5 h-5" />
            <span className="text-[10px]">Driver</span>
          </button>
        </div>
      </nav>

      {/* Login & Switch User Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onRoleSelect={(newRole) => setActiveTab(newRole)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainLayout />
      </SocketProvider>
    </AuthProvider>
  );
}
