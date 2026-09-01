// src/lib/cms/auth.ts
// Authentication utilities — Phase 3 IMPLEMENTATION
// Per D-4: admin@frank2025.com + PBKDF2-SHA256 hash + HttpOnly Cookie session
//
// Reference for hash format: scripts/seed-admin.mjs (already implements hash for seeding)
// Format: pbkdf2_sha256$<iterations>$<salt_b64url>$<hash_b64url>

import type { Env, User } from './types';

// ────────────────────────────────────────────────────
// Phase 3 — Implement
// ────────────────────────────────────────────────────

/** Verify plain password against stored PBKDF2 hash. Constant-time compare. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // TODO Phase 3: parse hash → { iterations, salt, expected }; derive bits; constant-time compare
  throw new Error('Not implemented — Phase 3');
}

/**
 * Create new session for userId.
 * Generates random 32-byte token, returns:
 *   - token (raw, returned to client via Set-Cookie)
 *   - tokenHash (SHA-256 of token, stored in DB)
 *   - expiresAt (ISO timestamp, default 7 days)
 */
export async function createSession(
  env: Env,
  userId: number,
  ttlDays = 7
): Promise<{ token: string; tokenHash: string; expiresAt: string }> {
  // TODO Phase 3: crypto.getRandomValues(32 bytes) → token; SHA-256 → tokenHash; INSERT sessions
  throw new Error('Not implemented — Phase 3');
}

/**
 * Lookup session by tokenHash; return User if session valid + not expired.
 * Auto-update last_used_at.
 */
export async function getSessionUser(env: Env, tokenHash: string): Promise<User | null> {
  // TODO Phase 3: JOIN sessions + users, check expires_at > now, return user
  throw new Error('Not implemented — Phase 3');
}

/** Invalidate session (DELETE row, or set expires_at to past). */
export async function deleteSession(env: Env, tokenHash: string): Promise<void> {
  // TODO Phase 3: DELETE FROM sessions WHERE token_hash = ?
  throw new Error('Not implemented — Phase 3');
}

/** Hash IP address for audit log (never store raw IP). */
export async function hashIp(ip: string): Promise<string> {
  // TODO Phase 3: SHA-256(ip + SESSION_SECRET salt) → hex
  throw new Error('Not implemented — Phase 3');
}
