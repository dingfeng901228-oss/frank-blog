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
 *
 * Phase C2d §37 — CSRF auto-refresh:
 * When a state-changing request is rejected with 403 CSRF_INVALID (typically
 * because the session pre-dates CSRF protection, so the browser has no
 * cms_csrf cookie to echo), we transparently call GET /api/admin/auth/csrf to
 * mint a fresh cookie and retry the original request once. Only after that
 * retry fails do we surface the error or fall back to the login redirect.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return apiFetchWithCsrfRetry(path, init, false);
}

async function apiFetchWithCsrfRetry(
  path: string,
  init: RequestInit,
  isRetry: boolean
): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };

  // Phase C2 §37 — auto-attach CSRF token for state-changing requests
  if (method !== 'GET') {
    const csrfToken = getCookie('cms_csrf');
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });

  // Phase C2d §37 — one-shot CSRF auto-refresh on 403 CSRF_INVALID.
  // Conditions:
  //   - Not a retry already (avoid infinite loops)
  //   - The error body specifically says CSRF_INVALID (don't auto-refresh on
  //     any 403 — could mask real auth failures)
  //   - We're inside /api/admin/* (don't trigger on unrelated 403s)
  //   - Session must still be alive — handled implicitly: if refresh fails,
  //     api-client falls through to the 401 redirect logic.
  if (
    !isRetry &&
    method !== 'GET' &&
    path.startsWith('/api/admin/') &&
    response.status === 403
  ) {
    const cloned = response.clone();
    let body: any = null;
    try {
      body = await cloned.json();
    } catch {
      /* not JSON — leave null */
    }
    if (body?.error?.code === 'CSRF_INVALID') {
      const refreshed = await tryRefreshCsrf();
      if (refreshed) {
        // Retry the original request once with the freshly-minted cookie.
        return apiFetchWithCsrfRetry(path, init, true);
      }
    }
  }

  // Auto-redirect on 401 (unless we're calling login or already on login page).
  // Also redirect on 403 CSRF_INVALID — typically means the cms_csrf cookie
  // was lost (user logged in before CSRF was enabled, or browser session
  // pre-dates the CSRF change). Re-login refreshes both cookies.
  if (response.status === 401 && !isLoginPath(path) && !isOnLoginPage()) {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
  } else if (response.status === 403 && !isLoginPath(path) && !isOnLoginPage()) {
    const cloned = response.clone();
    try {
      const data = await cloned.json().catch(() => null);
      if (data?.error?.code === 'CSRF_INVALID' && typeof window !== 'undefined') {
        // Auto-refresh above should have caught this, but if it didn't
        // (refresh endpoint also 403'd) fall back to forcing re-login.
        window.location.href = '/admin/login';
      }
    } catch {
      /* ignore */
    }
  }

  return response;
}

// Phase C2d §37 — call the CSRF refresh endpoint and let the browser store
// the new Set-Cookie. Returns true on success, false on any failure (caller
// should treat the original request as terminal in that case).
async function tryRefreshCsrf(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/auth/csrf', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

function isLoginPath(path: string): boolean {
  return path.startsWith('/api/admin/auth/login');
}

function isOnLoginPage(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin/login');
}

// Phase C2 §37 — read non-HttpOnly cookie value to mirror into X-CSRF-Token header.
// The server sets a non-HttpOnly cookie (cms_csrf) on login. For state-changing
// requests, the browser JS reads the cookie and echoes it as the
// X-CSRF-Token header (double-submit cookie pattern).
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
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

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
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
