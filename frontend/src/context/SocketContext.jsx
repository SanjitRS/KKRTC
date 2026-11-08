import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { offlineQueue } from '../utils/offlineQueue';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastTelemetry, setLastTelemetry] = useState(null);
  const [latestAnnouncement, setLatestAnnouncement] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // In dev, Vite proxies /socket.io to backend port 5000
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to tracking server with ID:', socket.id);
      setIsConnected(true);

      // Flush any queued offline location updates
      offlineQueue.flush(async (queuedItems) => {
        socket.emit('driver:batch_location_update', queuedItems);
      });
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from tracking server');
      setIsConnected(false);
    });

    socket.on('bus:telemetry', (data) => {
      setLastTelemetry(data);
    });

    socket.on('announcement:new', (data) => {
      setLatestAnnouncement(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoute = (routeId) => {
    if (socketRef.current && routeId) {
      socketRef.current.emit('join:route', routeId);
    }
  };

  const leaveRoute = (routeId) => {
    if (socketRef.current && routeId) {
      socketRef.current.emit('leave:route', routeId);
    }
  };

  const emit = (event, data, callback) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data, callback);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        lastTelemetry,
        latestAnnouncement,
        joinRoute,
        leaveRoute,
        emit
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
