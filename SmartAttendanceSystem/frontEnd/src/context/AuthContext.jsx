import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { clearStoredToken, getStoredToken, setStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(getStoredToken);
  const [loading, setLoading] = useState(true);

  /* Validate stored token on mount */
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUser(r.data.data.user))
      .catch(() => { clearStoredToken(); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredToken();
      setUser(null);
      setToken(null);
      setLoading(false);
    };

    window.addEventListener('sat:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('sat:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (identifier, password, remember = true) => {
    const r = await api.post('/auth/login', { identifier, password });
    const { user: u, token: t } = r.data.data;
    setStoredToken(t, remember);
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const changePassword = useCallback(async (payload) => {
    const r = await api.post('/auth/change-password', payload);
    const { user: updatedUser, token: updatedToken } = r.data.data;
    setStoredToken(updatedToken, localStorage.getItem('sat_token') !== null);
    setToken(updatedToken);
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
