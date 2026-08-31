/**
 * Axios client for the MoreFit backend (same FastAPI used by the mobile app).
 *
 * Auth strategy for the portal: **HttpOnly cookie** (`mf_portal_session`)
 * set by the backend on `POST /api/auth/portal/login`. The JS in this app
 * NEVER sees the token, so XSS cannot exfiltrate it.
 *
 * Requires `withCredentials: true` on every request + CORS
 * `allow_credentials=True` and explicit origin on the backend.
 */
import axios, { type AxiosInstance, type AxiosError } from 'axios';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.morefit.com.br';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
  withCredentials: true, // send/receive `mf_portal_session` cookie
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<any>) => {
    if (typeof window !== 'undefined' && err.response?.status === 401) {
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

export type LoginRes = { user: User };

export async function login(email: string, password: string): Promise<LoginRes> {
  // No token in the response body — server sets HttpOnly cookie
  const { data } = await api.post<LoginRes>('/auth/portal/login', { email, password });
  return data;
}

export async function me(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/portal/me');
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/portal/logout');
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
