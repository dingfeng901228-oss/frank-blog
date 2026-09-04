-- migrations/0003_categories_tags.sql
-- Phase 5 — Organization
-- Per docs/CMS V2.md §二十三 (Categories) + §二十四 (Tags)

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

-- Many-to-many post ↔ category (one category per post for v1, can extend later)
ALTER TABLE posts ADD COLUMN category_id INTEGER REFERENCES categories(id);

-- Many-to-many post ↔ tag
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
