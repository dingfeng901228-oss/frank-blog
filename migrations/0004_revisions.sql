-- migrations/0004_revisions.sql
-- Phase 6 — Revision History
-- Per docs/CMS V2.md §二十六 (post_revisions) + §二十七 (Optimistic Lock)

CREATE TABLE IF NOT EXISTS post_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  description_text TEXT,
  locale TEXT,
  status TEXT,
  changed_by INTEGER,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_post_revisions_post ON post_revisions(post_id, changed_at DESC);

-- For Optimistic Lock: track who is currently editing a post
-- (optional — can be done in-memory on client side per §二十七)
