// src/lib/cms/api-client.ts
// Browser-side API client — Phase 4 IMPLEMENTATION
// Used by new Admin SPA (src/app/admin/*) for fetch to /api/admin/*
// Per ADR-001 (Single Worker): /api/admin/* + /admin/* share the same Worker

// ────────────────────────────────────────────────────
// Phase 4 — Implement
// ────────────────────────────────────────────────────

/** Wrapper around fetch() that includes credentials (HttpOnly Cookie). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // TODO Phase 4: fetch(path, { ...init, credentials: 'include' }) + handle 401 redirect
  throw new Error('Not implemented — Phase 4');
}

export async function apiGet<T>(path: string): Promise<T> {
  // TODO Phase 4
  throw new Error('Not implemented — Phase 4');
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  // TODO Phase 4
  throw new Error('Not implemented — Phase 4');
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  // TODO Phase 4
  throw new Error('Not implemented — Phase 4');
}

export async function apiDelete<T>(path: string): Promise<T> {
  // TODO Phase 4
  throw new Error('Not implemented — Phase 4');
}

/**
 * Standard success response shape (per doc spec 二十三、API 设计).
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/**
 * Standard error response shape.
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
