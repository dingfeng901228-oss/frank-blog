// src/lib/cms/types.ts
// frank-blog CMS — TypeScript types matching D1 schema
// Per docs/ADR.md + migrations/0001_initial.sql
//
// Single source of truth for:
//   - DB row types (mirror schema column-for-column)
//   - CF Pages Functions Env binding types
//   - Pages context / handler types

// ────────────────────────────────────────────────────
// Domain enums
// ────────────────────────────────────────────────────

import type { D1Database, R2Bucket, D1Result } from '@cloudflare/workers-types';

export type Locale          = 'zh' | 'ja' | 'en';
export type PostStatus      = 'draft' | 'published' | 'archived';
export type PostCollection  = 'posts' | 'notes';
export type ContentFormat   = 'mdx' | 'md';
export type UserRole        = 'admin' | 'editor';
export type UserStatus      = 'active' | 'disabled';

// ────────────────────────────────────────────────────
// DB row types (mirror migrations/0001_initial.sql)
// ────────────────────────────────────────────────────

export interface User {
  id:             number;
  username:       string;
  email:          string;
  password_hash:  string;   // pbkdf2_sha256$<iter>$<salt_b64url>$<hash_b64url>
  display_name:   string | null;
  role:           UserRole;
  status:         UserStatus;
  created_at:     string;
  updated_at:     string;
  last_login_at:  string | null;
}

export interface Session {
  id:           number;
  user_id:      number;
  token_hash:   string;     // SHA-256 hex of session token (NEVER plaintext token)
  expires_at:   string;
  created_at:   string;
  last_used_at: string;
  ip_hash:      string | null;
  user_agent:   string | null;
}

export interface Post {
  id:               number;
  collection:       PostCollection;
  locale:           Locale;
  slug:             string;
  title:            string;
  description_raw:  string;   // D-6: original YAML literal, preserve block scalar
  description_text: string;   // parsed plain string for SEO meta
  content:          string;   // D-6: full MDX file (frontmatter + body), byte-level SoT
  content_format:   ContentFormat;
  excerpt:          string | null;
  cover_image:      string | null;
  status:           PostStatus;
  published_at:     string | null;
  created_at:       string;
  updated_at:       string;
  author_id:        number | null;
  reading_time:     string | null;
  view_count:       number;
  is_featured:      number;   // 0 | 1 (SQLite INTEGER + CHECK)
  tags:             string | null;  // MVP: JSON array string
}

// ────────────────────────────────────────────────────
// CF Workers/Pages Functions Env bindings
// ────────────────────────────────────────────────────

export interface Env {
  DB: D1Database;

  // Secrets — set via `wrangler pages secret put <NAME>`
  SESSION_SECRET?:              string;
  CLOUDFLARE_DEPLOY_HOOK_URL?:  string;
  ADMIN_PASSWORD?:              string;
  ENVIRONMENT?:                 string;

  // R2 (for image handling in v1.1; not used in MVP)
  R2?:                 R2Bucket;
  R2_ACCOUNT_ID?:      string;
  R2_ACCESS_KEY_ID?:   string;
  R2_SECRET_ACCESS_KEY?: string;
}

// ────────────────────────────────────────────────────
// CF Pages Function context types
// (Lightweight — we don't depend on @cloudflare/workers-types)
// ────────────────────────────────────────────────────

export interface PagesContext<P = unknown> {
  request:                  Request;
  env:                      Env;
  params:                   P;
  waitUntil:                (promise: Promise<unknown>) => void;
  passThroughOnException:   () => void;
  functionPath?:            string;
  data?:                    { user?: User };
}

export type PagesHandler<P = unknown> =
  (context: PagesContext<P>) => Promise<Response> | Response;

// ────────────────────────────────────────────────────
// Re-export from D1 (for convenience in handlers)
// ────────────────────────────────────────────────────

export type { D1Database, D1Result };
