// src/lib/cms/auth.ts
// Authentication utilities — PBKDF2 verify + session CRUD
// Per D-4: admin@frank2025.com + PBKDF2-SHA256 + HttpOnly Cookie session + admin_logs audit

import type { Env, User } from './types';
import { execute, queryFirst } from './db';
import {
  parsePasswordHash,
  randomBytes,
  toBase64Url,
  sha256Hex,
} from './crypto';

const SESSION_TTL_DAYS_DEFAULT = 7;
const FALLBACK_IP_SALT = 'frank-blog-cms-ip-salt';

// ────────────────────────────────────────────────────
// Password verification (constant-time)
// ────────────────────────────────────────────────────

/** Verify plain password against stored PBKDF2 hash. Constant-time compare. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  let parsed;
  try {
    parsed = parsePasswordHash(hash);
  } catch {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(plain),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: parsed.salt as Uint8Array<ArrayBuffer>,
      iterations: parsed.iterations,
      hash: 'SHA-256',
    },
    key,
    parsed.hash.length * 8
  );
  const derivedHash = new Uint8Array(bits);
  return constantTimeEqual(derivedHash, parsed.hash);
}

// ────────────────────────────────────────────────────
// Session lifecycle
// ────────────────────────────────────────────────────

/**
 * Create new session for userId.
 * Returns raw token (for Set-Cookie) + expiresAt ISO timestamp.
 * Stores SHA-256(token) in DB (NEVER plaintext).
 */
export async function createSession(
  env: Env,
  userId: number,
  ttlDays: number = SESSION_TTL_DAYS_DEFAULT
): Promise<{ token: string; expiresAt: string }> {
  const tokenBytes = randomBytes(32);
  const token = toBase64Url(tokenBytes);
  const tokenHash = await sha256Hex(token);

  const expiresAt = new Date(
    Date.now() + ttlDays * 24 * 60 * 60 * 1000
  ).toISOString();

  await execute(
    env,
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    [userId, tokenHash, expiresAt]
  );

  return { token, expiresAt };
}

/**
 * Lookup session by tokenHash; return User if session valid + not expired.
 * Auto-updates last_used_at (fire-and-forget).
 */
export async function getSessionUser(env: Env, tokenHash: string): Promise<User | null> {
  const session = await queryFirst<{ user_id: number; expires_at: string }>(
    env,
    `SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`,
    [tokenHash]
  );

  if (!session) return null;

  // Check expiry
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await deleteSession(env, tokenHash);
    return null;
  }

  // Update last_used_at (fire-and-forget — don't block auth response)
  execute(
    env,
    `UPDATE sessions SET last_used_at = datetime('now') WHERE token_hash = ?`,
    [tokenHash]
  ).catch(() => {});

  // Get user
  const user = await queryFirst<User>(
    env,
    `SELECT * FROM users WHERE id = ? AND status = 'active'`,
    [session.user_id]
  );

  return user;
}

/** Invalidate session (DELETE row by token_hash). */
export async function deleteSession(env: Env, tokenHash: string): Promise<void> {
  await execute(env, `DELETE FROM sessions WHERE token_hash = ?`, [tokenHash]);
}

// ────────────────────────────────────────────────────
// IP hashing (audit log)
// ────────────────────────────────────────────────────

/**
 * Hash IP address for admin_logs.ip_hash (never store raw IP per D-2).
 * Salted with SESSION_SECRET so hashes can't be reversed without secret.
 */
export async function hashIp(env: Env, ip: string): Promise<string> {
  const salt = env.SESSION_SECRET || FALLBACK_IP_SALT;
  return await sha256Hex(ip + salt);
}

// ────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
