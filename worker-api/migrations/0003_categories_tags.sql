-- migrations/0003_categories_tags.sql
-- Phase 5 — Organization
-- Per docs/CMS V2.md §二十三 (Categories) + §二十四 (Tags)
--
-- v2 (idempotent — no ALTER on posts table so order doesn't matter vs 0001_initial):
--   - post_category join table (one category per post, enforced by UNIQUE(post_id))
--   - categories + tags master tables
--   - post_tags join table (many-to-many)

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  collection TEXT NOT NULL CHECK(collection IN ('posts', 'notes')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(collection, slug)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_category (
  post_id INTEGER NOT NULL UNIQUE,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (post_id)
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_post_category_cat ON post_category(category_id);
