import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, getToken, setToken } from '@/src/api/client';

export type User = {
  user_id: string;
  email: string;
  name: string;
  avatar?: string | null;
  auth_provider?: string;
  onboarded?: boolean;
  height_cm?: number | null;
  starting_weight_kg?: number | null;
  goal_weight_kg?: number | null;
  daily_calorie_goal?: number;
  daily_water_ml_goal?: number;
  daily_steps_goal?: number;
  daily_sleep_hours_goal?: number;
  goal?: 'lose' | 'maintain' | 'gain' | 'improve_health';
  activity_level?: string;
  gender?: string | null;
  birth_date?: string | null;
  target_date?: string | null;
  photo_base64?: string | null;
  is_premium?: boolean;
  premium_expires_at?: string | null;
  subscription_tier?: 'free' | 'premium';
};

type Ctx = {
  loading: boolean;
  user: User | null;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUserState] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    try {
      const t = await getToken();
      if (!t) { setUserState(null); return; }
      const res = await api<{ user: User }>('/auth/me');
      setUserState(res.user);
    } catch {
      await setToken(null);
      setUserState(null);
    }
  }, []);

  const processSessionId = useCallback(async (session_id: string) => {
    // exchange emergent session_id -> profile with a session_token
    const r = await fetch('https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data', {
      headers: { 'X-Session-ID': session_id },
    });
    if (!r.ok) throw new Error('Sessão Google inválida');
    const data = await r.json();
    const st = data.session_token as string;
    const resp = await api<{ token: string; user: User }>('/auth/google-session', {
      method: 'POST', auth: false, body: { session_token: st },
    });
    await setToken(resp.token);
    setUserState(resp.user);
  }, []);

  // On mount: web URL parsing + mobile deep links + existing session
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash || '';
          const search = window.location.search || '';
          const combined = (hash.startsWith('#') ? hash.slice(1) : hash) + '&' + (search.startsWith('?') ? search.slice(1) : search);
          const sp = new URLSearchParams(combined);
          const sid = sp.get('session_id');
          if (sid) {
            try {
              await processSessionId(sid);
              window.history.replaceState(null, '', window.location.pathname);
              if (mounted) setLoading(false);
              return;
            } catch {}
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (initial) {
            const parsed = Linking.parse(initial);
            const sid = (parsed.queryParams?.session_id as string) || null;
            if (sid) { try { await processSessionId(sid); if (mounted) setLoading(false); return; } catch {} }
          }
        }
        await refresh();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const sub = Linking.addEventListener('url', async (ev) => {
      const parsed = Linking.parse(ev.url);
      const sid = (parsed.queryParams?.session_id as string) || null;
      if (sid) { try { await processSessionId(sid); } catch {} }
    });
    return () => { mounted = false; sub.remove(); };
  }, [refresh, processSessionId]);

  const register = async (name: string, email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/register', {
      method: 'POST', auth: false, body: { name, email, password },
    });
    await setToken(res.token);
    setUserState(res.user);
  };

  const login = async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST', auth: false, body: { email, password },
    });
    await setToken(res.token);
    setUserState(res.user);
  };

  const loginWithGoogle = async () => {
    const redirect = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.location.origin + '/' : '')
      : Linking.createURL('');
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
    if (Platform.OS === 'web') {
      window.location.href = authUrl; return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
    if (result.type !== 'success' || !result.url) return;
    const parsed = Linking.parse(result.url);
    const sid = (parsed.queryParams?.session_id as string) || null;
    if (sid) await processSessionId(sid);
  };

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    await setToken(null);
    setUserState(null);
  };

  const value = useMemo<Ctx>(() => ({
    loading, user, register, login, loginWithGoogle, logout, refresh,
    setUser: (u) => setUserState(u),
  }), [loading, user, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
