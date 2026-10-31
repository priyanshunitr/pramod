import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Session } from '@hotel/contracts';

interface AuthState extends Session { loading: boolean; error: string | null; refresh: () => Promise<void>; logout: () => Promise<void>; }
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ user: null, memberships: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setSession(await api<Session>('/auth/me')); setError(null); }
    catch { setSession({ user: null, memberships: [] }); setError('We couldn’t check your account. Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  async function logout() {
    await api('/auth/logout', {});
    setSession({ user: null, memberships: [] });
  }
  return <AuthContext.Provider value={{ ...session, loading, error, refresh, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}
