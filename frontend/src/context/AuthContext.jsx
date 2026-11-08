import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nitte_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('nitte_token') || null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If no user saved, auto-load demo student for instant out-of-the-box demo
    if (!user) {
      demoLogin('student');
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (identifier, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('nitte_user', JSON.stringify(data.user));
      localStorage.setItem('nitte_token', data.token);
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('nitte_user', JSON.stringify(data.user));
      localStorage.setItem('nitte_token', data.token);
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  const demoLogin = async (role = 'student', userId = null) => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, userId })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('nitte_user', JSON.stringify(data.user));
        localStorage.setItem('nitte_token', data.token);
      }
    } catch (err) {
      console.error('[AUTH] Demo login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem('nitte_user', JSON.stringify(data.user));
        return data.user;
      }
    } catch (err) {
      console.error('[AUTH] Update profile error:', err);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('nitte_user');
    localStorage.removeItem('nitte_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || 'student',
        loading,
        login,
        register,
        demoLogin,
        updateProfile,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
