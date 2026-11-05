import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [booting, setBooting] = useState(Boolean(getToken()));
  const [sessionExpired, setSessionExpired] = useState(false);

  const signOut = useCallback((expired = false) => {
    setToken(null);
    setAdmin(null);
    setSessionExpired(expired);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => signOut(true));
  }, [signOut]);

  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((d) => setAdmin(d.admin))
      .catch(() => signOut(false))
      .finally(() => setBooting(false));
  }, [signOut]);

  const signIn = useCallback(async (email, password) => {
    const d = await api.post('/auth/login', { email, password });
    setToken(d.token);
    setSessionExpired(false);
    setAdmin(d.admin);
    return d.admin;
  }, []);

  const value = useMemo(() => {
    const perms = new Set(admin?.permissions || []);
    return {
      admin,
      booting,
      sessionExpired,
      signIn,
      signOut: () => signOut(false),
      refreshToken: (token) => setToken(token),
      can: (...p) => p.some((x) => perms.has(x)),
    };
  }, [admin, booting, sessionExpired, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
