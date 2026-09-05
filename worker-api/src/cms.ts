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

// Phase 4 — Media
export interface MediaRecord {
  id: number;
  filename: string;
  mime_type: string;
  size: number;
  r2_key: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string;
}

// Phase 5 — Categories + Tags
export interface CategoryRecord {
  id: number;
  name: string;
  slug: string;
  collection: PostCollection;
  created_at: string;
}

export interface TagRecord {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

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
  RATE_LIMIT?: KVNamespace;
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

export function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
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

// ────────────────────────────────────────────────────────────────────────────
// Phase C2 §37 — CSRF double-submit cookie helpers
// Sets a non-HttpOnly cookie with a random token. Browser echoes it as the
// X-CSRF-Token header on state-changing requests (POST/PUT/DELETE). GET
// requests skip the check. Login endpoint also skips (user not authenticated
// yet). See checkCsrfIfNeeded() in index.ts for the enforcement point.
// ────────────────────────────────────────────────────────────────────────────

export const CSRF_COOKIE_NAME = 'cms_csrf';

export function buildCsrfCookie(token: string, expiresAt: string): string {
  const maxAge = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );
  return [
    `${CSRF_COOKIE_NAME}=${token}`,
    // Intentionally NOT HttpOnly: frontend JS reads via document.cookie
    // and mirrors into X-CSRF-Token header on non-GET requests.
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export function buildClearCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ────────────────────────────────────────────────────────────────────────────
// Phase C2b §37 — Per-IP rate limit (60 req/min, fixed-minute bucket).
// Uses CF KV as a counter store. Key format: `ip:<ip>:<unix-minute>`. Old
// buckets auto-expire via expirationTtl=120 (covers boundary minute safely).
// Skip if KV binding is missing (dev without KV namespace).
// Per-user (300 req/min) can be added by reading session cookie before this
// check; not implemented yet to keep the call site simple (IP-only for now).
// ────────────────────────────────────────────────────────────────────────────

export const RATE_LIMIT_PER_MIN = 60;
export const RATE_LIMIT_KV_TTL_SECONDS = 120;

export async function checkRateLimit(
  kv: KVNamespace | undefined,
  request: Request
): Promise<Response | null> {
  if (!kv) return null;
  const ip = getRequestIp(request);
  const minute = Math.floor(Date.now() / 60000);
  const key = `ip:${ip}:${minute}`;
  const current = parseInt((await kv.get(key)) || '0', 10);
  if (current >= RATE_LIMIT_PER_MIN) {
    return json(
      {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      },
      429,
      { 'Retry-After': '60' }
    );
  }
  await kv.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_KV_TTL_SECONDS });
  return null;
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

// ────────────────────────────────────────────────────
// Phase 4 — Media (R2 storage + D1 metadata)
// Per docs/CMS V2.md §十四 (R2 blobs + D1 metadata) + §十五 (upload flow) + §十六 (alt text)
// ────────────────────────────────────────────────────

export const MEDIA_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const MEDIA_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function mediaPublicUrl(r2Key: string, env: Env): string {
  // Use R2 public dev URL or custom domain when configured.
  // For now we expose /cdn/<key> route which Worker can serve from R2.
  // (In production, configure R2 custom domain and use that here.)
  return `/cdn/${r2Key}`;
}

export async function listMedia(
  env: Env,
  options: { limit?: number; offset?: number; search?: string } = {}
): Promise<{ items: MediaRecord[]; total: number }> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const offset = Math.max(0, options.offset ?? 0);
  const search = options.search?.trim() ?? '';

  const where: string[] = [];
  const params: unknown[] = [];
  if (search) {
    where.push('(filename LIKE ? OR alt LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await queryFirst<{ n: number }>(
    env,
    `SELECT COUNT(*) as n FROM media ${whereClause}`,
    params
  );
  const items = await queryAll<MediaRecord>(
    env,
    `SELECT id, filename, mime_type, size, r2_key, url, alt, width, height, uploaded_by, created_at, updated_at
     FROM media ${whereClause}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items, total: totalRow?.n ?? 0 };
}

export async function getMedia(env: Env, id: number): Promise<MediaRecord | null> {
  return queryFirst<MediaRecord>(
    env,
    `SELECT id, filename, mime_type, size, r2_key, url, alt, width, height, uploaded_by, created_at, updated_at
     FROM media WHERE id = ?`,
    [id]
  );
}

/**
 * Upload a media file to R2 and save metadata to D1.
 * Returns the new media record.
 * Throws if R2 binding is missing, MIME invalid, or size exceeds limit.
 */
// Phase C2c §37 — Magic byte verification for image MIME types. Prevents type
// confusion attacks where a client claims e.g. image/png but uploads a script
// or executable. First 12 bytes is enough for all formats we accept.
export function validateMagicBytes(data: ArrayBuffer, mime: string): boolean {
  const bytes = new Uint8Array(data.slice(0, 12));
  switch (mime) {
    case 'image/png':
      return bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
        bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A;
    case 'image/jpeg':
      return bytes.length >= 3 &&
        bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    case 'image/gif':
      return bytes.length >= 6 &&
        bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
    case 'image/webp':
      return bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    default:
      return false;
  }
}

export async function uploadMedia(
  env: Env,
  file: { name: string; type: string; size: number; data: ArrayBuffer },
  alt: string,
  uploadedBy: number | null
): Promise<MediaRecord> {
  if (!env.R2) {
    throw new Error('R2 binding not configured — Worker needs R2 bucket binding');
  }
  if (!MEDIA_ALLOWED_MIME.includes(file.type as any)) {
    throw new Error(`Unsupported MIME type: ${file.type}. Allowed: ${MEDIA_ALLOWED_MIME.join(', ')}`);
  }
  if (file.size > MEDIA_MAX_SIZE) {
    throw new Error(`File too large: ${file.size} bytes (max ${MEDIA_MAX_SIZE})`);
  }
  // Phase C2c §37 — Verify file content actually matches claimed MIME type
  // (defends against type confusion: client says image/png but uploads a script)
  if (!validateMagicBytes(file.data, file.type)) {
    throw new Error(`File content does not match claimed MIME type: ${file.type}`);
  }

  const ext = file.name.split('.').pop() || 'bin';
  const r2Key = `media/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  await env.R2.put(r2Key, file.data, {
    httpMetadata: { contentType: file.type },
    customMetadata: { alt: alt.slice(0, 256), originalName: file.name },
  });

  const url = mediaPublicUrl(r2Key, env);

  const result = await queryFirst<MediaRecord>(
    env,
    `INSERT INTO media (filename, mime_type, size, r2_key, url, alt, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id, filename, mime_type, size, r2_key, url, alt, width, height, uploaded_by, created_at, updated_at`,
    [file.name, file.type, file.size, r2Key, url, alt, uploadedBy]
  );
  if (!result) throw new Error('Failed to insert media record');
  return result;
}

/**
 * Delete a media file from R2 and D1.
 * Checks post_media join table for references — throws if any posts still use it.
 */
export async function deleteMedia(env: Env, id: number): Promise<void> {
  const record = await getMedia(env, id);
  if (!record) throw new Error('Media not found');

  // Reference check (per §三十一)
  const usage = await queryFirst<{ n: number }>(
    env,
    `SELECT COUNT(*) as n FROM post_media WHERE media_id = ?`,
    [id]
  );
  if (usage && usage.n > 0) {
    throw new Error(`This image is currently used by ${usage.n} article(s). Remove references first.`);
  }

  if (env.R2) {
    try {
      await env.R2.delete(record.r2_key);
    } catch (e) {
      // R2 delete is best-effort — continue even if R2 fails
      console.warn(`Failed to delete R2 object ${record.r2_key}:`, e);
    }
  }

  await execute(env, `DELETE FROM media WHERE id = ?`, [id]);
}

// ────────────────────────────────────────────────────
// Phase 5 — Categories + Tags
// Per docs/CMS V2.md §二十三 (Categories) + §二十四 (Tags)
// ────────────────────────────────────────────────────

export async function listCategories(
  env: Env,
  collection?: PostCollection
): Promise<CategoryRecord[]> {
  const where = collection ? 'WHERE collection = ?' : '';
  const params = collection ? [collection] : [];
  return queryAll<CategoryRecord>(
    env,
    `SELECT id, name, slug, collection, created_at
     FROM categories ${where}
     ORDER BY collection, name`,
    params
  );
}

export async function createCategory(
  env: Env,
  name: string,
  slug: string,
  collection: PostCollection
): Promise<CategoryRecord> {
  if (!['posts', 'notes'].includes(collection)) {
    throw new Error('collection must be "posts" or "notes"');
  }
  const result = await queryFirst<CategoryRecord>(
    env,
    `INSERT INTO categories (name, slug, collection) VALUES (?, ?, ?)
     RETURNING id, name, slug, collection, created_at`,
    [name, slug, collection]
  );
  if (!result) throw new Error('Failed to create category');
  return result;
}

export async function updateCategory(
  env: Env,
  id: number,
  name: string,
  slug: string
): Promise<void> {
  await execute(env, `UPDATE categories SET name = ?, slug = ? WHERE id = ?`, [name, slug, id]);
}

export async function deleteCategory(env: Env, id: number): Promise<void> {
  // Check if any posts reference this category
  const usage = await queryFirst<{ n: number }>(
    env,
    `SELECT COUNT(*) as n FROM posts WHERE category_id = ?`,
    [id]
  );
  if (usage && usage.n > 0) {
    throw new Error(`Cannot delete: ${usage.n} article(s) still use this category`);
  }
  await execute(env, `DELETE FROM categories WHERE id = ?`, [id]);
}

export async function listTags(env: Env): Promise<TagRecord[]> {
  return queryAll<TagRecord>(
    env,
    `SELECT id, name, slug, created_at FROM tags ORDER BY name`
  );
}

export async function createTag(env: Env, name: string, slug: string): Promise<TagRecord> {
  const result = await queryFirst<TagRecord>(
    env,
    `INSERT INTO tags (name, slug) VALUES (?, ?)
     RETURNING id, name, slug, created_at`,
    [name, slug]
  );
  if (!result) throw new Error('Failed to create tag');
  return result;
}

export async function updateTag(env: Env, id: number, name: string, slug: string): Promise<void> {
  await execute(env, `UPDATE tags SET name = ?, slug = ? WHERE id = ?`, [name, slug, id]);
}

export async function deleteTag(env: Env, id: number): Promise<void> {
  // Check usage in post_tags
  const usage = await queryFirst<{ n: number }>(
    env,
    `SELECT COUNT(*) as n FROM post_tags WHERE tag_id = ?`,
    [id]
  );
  if (usage && usage.n > 0) {
    throw new Error(`Cannot delete: ${usage.n} article(s) still use this tag`);
  }
  await execute(env, `DELETE FROM tags WHERE id = ?`, [id]);
}

// ────────────────────────────────────────────────────
// Phase 6 — Activity log + Revisions + Optimistic Lock
// Per docs/CMS V2.md §二十五 (Activity) + §二十六 (Revisions) + §二十七 (Optimistic Lock)
// ────────────────────────────────────────────────────

export interface ActivityEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  ip_hash: string | null;
  created_at: string;
}

export interface PostRevision {
  id: number;
  post_id: number;
  title: string;
  slug: string;
  content: string;
  description_text: string | null;
  locale: string | null;
  status: string | null;
  changed_by: number | null;
  changed_at: string;
}

export async function listRecentActivity(env: Env, limit: number = 20): Promise<ActivityEntry[]> {
  const n = Math.min(100, Math.max(1, limit));
  return queryAll<ActivityEntry>(
    env,
    `SELECT al.id, al.user_id, u.username, al.action, al.resource_type, al.resource_id, al.ip_hash, al.created_at
     FROM admin_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.id DESC
     LIMIT ?`,
    [n]
  );
}

export async function createRevision(
  env: Env,
  post: { id: number; title: string; slug: string; content: string; description_text: string | null; locale: Locale | null; status: PostStatus | null },
  changedBy: number | null
): Promise<void> {
  await execute(
    env,
    `INSERT INTO post_revisions (post_id, title, slug, content, description_text, locale, status, changed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [post.id, post.title, post.slug, post.content, post.description_text, post.locale, post.status, changedBy]
  );
}

export async function listRevisions(env: Env, postId: number): Promise<PostRevision[]> {
  return queryAll<PostRevision>(
    env,
    `SELECT id, post_id, title, slug, content, description_text, locale, status, changed_by, changed_at
     FROM post_revisions WHERE post_id = ?
     ORDER BY changed_at DESC
     LIMIT 50`,
    [postId]
  );
}

export async function getRevision(env: Env, revisionId: number): Promise<PostRevision | null> {
  return queryFirst<PostRevision>(
    env,
    `SELECT id, post_id, title, slug, content, description_text, locale, status, changed_by, changed_at
     FROM post_revisions WHERE id = ?`,
    [revisionId]
  );
}

export async function restoreRevision(env: Env, revisionId: number): Promise<void> {
  const rev = await getRevision(env, revisionId);
  if (!rev) throw new Error('Revision not found');
  await execute(
    env,
    `UPDATE posts
     SET title = ?, slug = ?, content = ?, description_text = ?, locale = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [rev.title, rev.slug, rev.content, rev.description_text, rev.locale, rev.status, rev.post_id]
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Auto-save (Phase A §19 — saves content/title/slug/description_text without
// touching status. Used by editor's debounced auto-save effect. Does NOT write
// to post_revisions — that's reserved for explicit Save Draft / Publish actions.
// ────────────────────────────────────────────────────────────────────────────

export async function saveDraft(
  env: Env,
  id: number,
  fields: { title: string; slug: string; content: string; description_text: string }
): Promise<void> {
  await execute(
    env,
    `UPDATE posts
     SET title = ?, slug = ?, content = ?, description_text = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [fields.title, fields.slug, fields.content, fields.description_text, id]
  );
}
