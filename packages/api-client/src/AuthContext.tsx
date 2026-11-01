import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, AUTH_REQUIRED_EVENT } from './api';
import type { Session } from '@hotel/contracts';

interface AuthState extends Session { loading: boolean; error: string | null; refresh: () => Promise<void>; logout: () => Promise<void>; }
const AuthContext = createContext<AuthState | null>(null);
const anonymous: Session = { user: null, memberships: [], expiresAt: null };
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(anonymous);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const next = await api<Session>('/auth/me', undefined, controller.signal);
      if (!controller.signal.aborted) { setSession(next); setError(null); }
    } catch {
      if (!controller.signal.aborted) { setSession(anonymous); setError('We couldn’t check your account. Please try again.'); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener(AUTH_REQUIRED_EVENT, onFocus);
    return () => {
      pending.current?.abort();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(AUTH_REQUIRED_EVENT, onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!session.expiresAt) return;
    // Re-check the cookie: another app/tab may have signed in since this snapshot.
    const delay = Math.max(1000, Date.parse(session.expiresAt) - Date.now() + 250);
    const timeout = window.setTimeout(() => { void refresh(); }, delay);
    return () => window.clearTimeout(timeout);
  }, [session, refresh]);
  async function logout() {
    await api('/auth/logout', {});
    pending.current?.abort();
    setSession(anonymous);
    setError(null);
    setLoading(false);
  }
  return <AuthContext.Provider value={{ ...session, loading, error, refresh, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}
