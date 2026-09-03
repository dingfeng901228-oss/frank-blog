// worker-api/src/cms.ts
// Shared utilities for frank-blog-cms-api Worker
// Originally in functions/cms/{auth,crypto,db,deploy,types}.ts (Pages Functions)
// Moved here unchanged — D1 binding now works because wrangler deploy
// (vs pages deploy) actually applies [[d1_databases]] to the Worker.

import type { D1Database, R2Bucket, D1Result } from '@cloudflare/workers-types';

// ────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────

export type Locale = 'zh' | 'ja' | 'en';
export type PostStatus = 'draft' | 'published' | 'archived';
export type PostCollection = 'posts' | 'notes';
export type ContentFormat = 'mdx' | 'md';
export type UserRole = 'admin' | 'editor';
export type UserStatus = 'active' | 'disabled';

export interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
  CLOUDFLARE_DEPLOY_HOOK_URL?: string;
  ADMIN_PASSWORD?: string;
  ENVIRONMENT?: string;
  R2?: R2Bucket;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Session {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at: string;
  ip_hash: string | null;
  user_agent: string | null;
}

export interface Post {
  id: number;
  collection: PostCollection;
  locale: Locale;
  slug: string;
  title: string;
  description_raw: string;
  description_text: string;
  content: string;
  content_format: ContentFormat;
  excerpt: string | null;
  cover_image: string | null;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: number | null;
  reading_time: string | null;
  view_count: number;
  is_featured: number;
  tags: string | null;
}

export interface DeployResult {
  triggered: boolean;
  error: string | null;
  ts: string;
}

// ────────────────────────────────────────────────────
// D1 query helpers
// ────────────────────────────────────────────────────

export function getDB(env: Env): D1Database {
  if (!env.DB) {
    throw new Error('D1 binding "DB" not configured — check wrangler.toml [[d1_databases]] block.');
  }
  return env.DB;
}

export async function queryFirst<T = unknown>(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const stmt = getDB(env).prepare(sql).bind(...params);
  return await stmt.first<T>();
}

export async function queryAll<T = unknown>(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const stmt = getDB(env).prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return result.results ?? [];
}

export async function execute(
  env: Env,
  sql: string,
  params: unknown[] = []
): Promise<D1Result> {
  const stmt = getDB(env).prepare(sql).bind(...params);
  return await stmt.run();
}

// ────────────────────────────────────────────────────
// Crypto utilities (PBKDF2, SHA-256, base64url)
// ────────────────────────────────────────────────────

export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTES = 16;
export const HASH_BYTES = 32;

export function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  let padded = s.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function parsePasswordHash(stored: string): {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
} {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
    throw new Error('Invalid password hash format');
  }
  return {
    iterations: parseInt(parts[1], 10),
    salt: fromBase64Url(parts[2]),
    hash: fromBase64Url(parts[3]),
  };
}

// ────────────────────────────────────────────────────
// Auth utilities (password verify, sessions)
// ────────────────────────────────────────────────────

const SESSION_TTL_DAYS_DEFAULT = 7;
const FALLBACK_IP_SALT = 'frank-blog-cms-ip-salt';

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

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function createSession(
  env: Env,
  userId: number,
  ttlDays: number = SESSION_TTL_DAYS_DEFAULT
): Promise<{ token: string; expiresAt: string }> {
  const tokenBytes = randomBytes(32);
  const token = toBase64Url(tokenBytes);
  const tokenHash = await sha256Hex(token);

  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  await execute(
    env,
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    [userId, tokenHash, expiresAt]
  );

  return { token, expiresAt };
}

export async function getSessionUser(env: Env, tokenHash: string): Promise<User | null> {
  const session = await queryFirst<{ user_id: number; expires_at: string }>(
    env,
    `SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`,
    [tokenHash]
  );

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await deleteSession(env, tokenHash);
    return null;
  }

  // Fire-and-forget last_used_at update
  execute(
    env,
    `UPDATE sessions SET last_used_at = datetime('now') WHERE token_hash = ?`,
    [tokenHash]
  ).catch(() => {});

  return await queryFirst<User>(
    env,
    `SELECT * FROM users WHERE id = ? AND status = 'active'`,
    [session.user_id]
  );
}

export async function deleteSession(env: Env, tokenHash: string): Promise<void> {
  await execute(env, `DELETE FROM sessions WHERE token_hash = ?`, [tokenHash]);
}

export async function hashIp(env: Env, ip: string): Promise<string> {
  const salt = env.SESSION_SECRET || FALLBACK_IP_SALT;
  return await sha256Hex(ip + salt);
}

/**
 * Log a failed login attempt to admin_logs (audit trail per D-4).
 * userId is null if the email doesn't exist; reason distinguishes
 * USER_NOT_FOUND vs BAD_PASSWORD for analytics.
 */
export async function logFailedLogin(
  env: Env,
  userId: number | null,
  reason: string,
  ipHash: string
): Promise<void> {
  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, ip_hash, resource_type) VALUES (?, ?, ?, ?)`,
    [userId, 'login_failed', ipHash, reason]
  );
}

// ────────────────────────────────────────────────────
// Deploy hook
// ────────────────────────────────────────────────────

export async function triggerDeployHook(env: Env): Promise<DeployResult> {
  const url = env.CLOUDFLARE_DEPLOY_HOOK_URL;
  const ts = new Date().toISOString();

  if (!url) {
    return {
      triggered: false,
      error: 'CLOUDFLARE_DEPLOY_HOOK_URL not configured (run `wrangler secret put CLOUDFLARE_DEPLOY_HOOK_URL`)',
      ts,
    };
  }

  try {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) {
      return { triggered: true, error: null, ts };
    }
    return {
      triggered: false,
      error: `Deploy hook returned HTTP ${res.status}`,
      ts,
    };
  } catch (e) {
    return {
      triggered: false,
      error: e instanceof Error ? e.message : String(e),
      ts,
    };
  }
}

// ────────────────────────────────────────────────────
// HTTP helpers
// ────────────────────────────────────────────────────

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

export const SESSION_COOKIE_NAME = 'cms_session';
export function buildSessionCookie(token: string, expiresAt: string): string {
  const maxAge = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export function buildClearCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function publicUser(user: User): {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
} {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
  };
}

export function getRequestIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || '0.0.0.0';
}

export function buildDescriptionRaw(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (!text.includes('\n')) {
    return `description: "${escaped}"`;
  }
  const lines = text.split('\n').map((l) => '  ' + l).join('\n');
  return `description: >\n${lines}`;
}
