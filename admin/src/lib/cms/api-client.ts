// src/lib/cms/api-client.ts
// Browser-side API client — Phase 4 IMPLEMENTATION
// Used by new Admin SPA (src/app/admin/*) for fetch to /api/admin/*
// Per ADR-001 (Single Worker): /api/admin/* + /admin/* share the same Worker

// ────────────────────────────────────────────────────
// Standard response shapes (per doc spec 二十三、API 设计)
// ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

// ────────────────────────────────────────────────────
// Core fetch wrapper
// ────────────────────────────────────────────────────

/**
 * fetch wrapper for /api/admin/* endpoints.
 * - credentials: 'include' — sends HttpOnly session cookie
 * - JSON Content-Type by default
 * - 401 → redirect to /admin/login (unless already on login page or explicitly skipped)
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });

  // Auto-redirect on 401 (unless we're calling login or already on login page)
  if (response.status === 401 && !isLoginPath(path) && !isOnLoginPage()) {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
  }

  return response;
}

function isLoginPath(path: string): boolean {
  return path.startsWith('/api/admin/auth/login');
}

function isOnLoginPage(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin/login');
}

// ────────────────────────────────────────────────────
// Typed helpers (throw on error)
// ────────────────────────────────────────────────────

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  return parseResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  return parseResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  return parseResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: 'DELETE' });
  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as ApiResponse<T>;
  if (!data.success) {
    const err = new Error(data.error.message);
    (err as any).code = data.error.code;
    (err as any).status = res.status;
    throw err;
  }
  return data.data;
}

// ────────────────────────────────────────────────────
// Auth-specific helpers
// ────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return apiPost<{ user: AuthUser; expires_at: string }>('/api/admin/auth/login', {
    email,
    password,
  }).then((data) => data.user);
}

export async function logout(): Promise<void> {
  await apiPost<{ logged_out: true }>('/api/admin/auth/logout', {});
}

export async function getMe(): Promise<AuthUser> {
  const data = await apiGet<{ user: AuthUser }>('/api/admin/auth/me');
  return data.user;
}
