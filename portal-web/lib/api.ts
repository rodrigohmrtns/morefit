/**
 * Axios client for the MoreFit backend (same FastAPI used by the mobile app).
 *
 * Auth strategy: reuses the same JWT the mobile app issues via POST /api/auth/login.
 * The JWT is stored in an HTTP-only-ish cookie via `js-cookie` (SameSite=Lax, secure in prod).
 *
 * Note: This portal is intended for users whose account role includes any of:
 *   - "nutritionist" | "personal" | "doctor" | "admin"
 * The middleware will redirect anyone without a professional role to /login.
 */
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import Cookies from 'js-cookie';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.morefit.com.br';

export const TOKEN_COOKIE = 'mf_token';

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_COOKIE);
}

export function setToken(token: string, days = 30) {
  Cookies.set(TOKEN_COOKIE, token, {
    expires: days,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearToken() {
  Cookies.remove(TOKEN_COOKIE);
}

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<any>) => {
    if (typeof window !== 'undefined' && err.response?.status === 401) {
      clearToken();
      // Only redirect if we're not already on the login page (avoids loops)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------
export type User = {
  user_id: string;
  name: string;
  email: string;
  role?: 'user' | 'nutritionist' | 'personal' | 'doctor' | 'admin';
  is_premium?: boolean;
  photo_base64?: string | null;
};

export type LoginRes = { token: string; user: User };

export async function login(email: string, password: string): Promise<LoginRes> {
  const { data } = await api.post<LoginRes>('/auth/login', { email, password });
  return data;
}

export async function me(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

// ---------------------------------------------------------------------------
// Professional endpoints (all live under /api/professionals/*)
// ---------------------------------------------------------------------------
export type SharedPatient = {
  user_id: string;
  name: string;
  email: string;
  shared_at: string;
  goal?: string;
  weight_kg?: number;
  height_cm?: number;
};

export async function listSharedPatients(): Promise<{ items: SharedPatient[] }> {
  const { data } = await api.get('/professionals/patients');
  return data;
}

export type PatientSummary = {
  user: User & { goal?: string; height_cm?: number };
  weights: Array<{ date: string; weight_kg: number; body_fat_pct?: number }>;
  meals: Array<{ date: string; name: string; calories: number }>;
  exercises: Array<{ date: string; name: string; duration_min: number; calories_burned: number }>;
  sleeps: Array<{ date: string; hours: number; quality: string }>;
};

export async function getPatientSummary(userId: string): Promise<PatientSummary> {
  const { data } = await api.get(`/professionals/patients/${userId}`);
  return data;
}
