import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Profile } from '../lib/types';

interface AuthCtx {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: (reason?: string) => void;
  refresh: () => Promise<void>;
  error: string | null;
  setError: (e: string | null) => void;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, login: async () => {}, logout: () => {}, refresh: async () => {}, error: null, setError: () => {} });

// Inactivity timeout: 5 minutes of no user interaction
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear legacy localStorage session to enforce browser-close session termination
    localStorage.removeItem('ngo_session');

    try {
      const raw = sessionStorage.getItem('ngo_session');
      if (raw) {
        const saved = JSON.parse(raw);
        fetch(`/api/auth?id=${saved.id}`)
          .then((r) => r.text())
          .then((text) => (text ? JSON.parse(text) : null))
          .then((fresh) => {
            if (fresh && fresh.id && fresh.active !== false) {
              setUser(fresh);
              sessionStorage.setItem('ngo_session', JSON.stringify(fresh));
            } else {
              sessionStorage.removeItem('ngo_session');
            }
          })
          .catch(() => setUser(saved))
          .finally(() => setLoading(false));
      } else setLoading(false);
    } catch { setLoading(false); }
  }, []);

  const logout = (reason?: string) => {
    setUser(null);
    sessionStorage.removeItem('ngo_session');
    localStorage.removeItem('ngo_session');
    if (reason) {
      setError(reason);
    }
  };

  const login = async (email: string, password: string, fullName?: string) => {
    setError(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName || undefined }),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error((data && (data.error || data.message)) || `Login failed (${res.status})`);
    setUser(data);
    sessionStorage.setItem('ngo_session', JSON.stringify(data));
  };

  const refresh = async () => {
    const raw = sessionStorage.getItem('ngo_session');
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      const res = await fetch(`/api/auth?id=${saved.id}`);
      const text = await res.text();
      const fresh = text ? JSON.parse(text) : null;
      if (fresh && fresh.id) {
        setUser(fresh);
        sessionStorage.setItem('ngo_session', JSON.stringify(fresh));
      }
    } catch {}
  };

  // Immediate auto-logout after inactivity (5 minutes of idle time)
  useEffect(() => {
    if (!user) return;

    let timer: NodeJS.Timeout | number;

    const resetInactivityTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        logout('You have been automatically logged out due to inactivity.');
      }, INACTIVITY_TIMEOUT_MS);
    };

    resetInactivityTimer();

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    return () => {
      if (timer) clearTimeout(timer);
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
    };
  }, [user?.id]);

  return <Ctx.Provider value={{ user, loading, login, logout, refresh, error, setError }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

