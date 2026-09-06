-- migrations/0004_revisions.sql
-- Phase 6 — Revision History
-- Per docs/CMS V2.md §二十六 (post_revisions) + §二十七 (Optimistic Lock)
--
-- NOTE: post_revisions table was originally created by 0001_initial.sql
-- (with columns created_at + created_by). The Phase 6 schema with
-- changed_at + slug + locale + status + description_text is added by
-- 0005_revisions_columns.sql as additive ALTER statements, so this
-- migration becomes a safe no-op on fresh DBs and a no-op (CREATE TABLE
-- IF NOT EXISTS) on DBs where 0001 already ran.
--
-- The original 0004 SQL is kept commented out below for reference; it
-- failed to apply historically because the CREATE INDEX referenced
-- post_revisions.changed_at which 0001's table doesn't have.
--
-- CREATE TABLE IF NOT EXISTS post_revisions (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   post_id INTEGER NOT NULL,
--   title TEXT NOT NULL,
--   slug TEXT NOT NULL,
--   content TEXT NOT NULL,
--   description_text TEXT,
--   locale TEXT,
--   status TEXT,
--   changed_by INTEGER,
--   changed_at TEXT NOT NULL DEFAULT (datetime('now'))
-- );

-- Idempotent CREATE — no-op if 0001 already created the table.
CREATE TABLE IF NOT EXISTS post_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- full MDX snapshot
  excerpt TEXT,
  description_raw TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (post_id)    REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Use 0001's column name (created_at) for the index. The richer changed_at
-- index is created by 0005_revisions_columns.sql after the column is added.
CREATE INDEX IF NOT EXISTS idx_post_revisions_post ON post_revisions(post_id, created_at DESC);

-- For Optimistic Lock: track who is currently editing a post
-- (optional — can be done in-memory on client side per §二十七)
