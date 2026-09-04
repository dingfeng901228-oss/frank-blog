-- migrations/0002_media.sql
-- Phase 4 — Media Library
-- Per docs/CMS V2.md §十四 (D1 media metadata only, blobs in R2)

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  width INTEGER,
  height INTEGER,
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_filename ON media(filename);

-- post_media join table: tracks which images are used by which posts (for reference check on delete)
CREATE TABLE IF NOT EXISTS post_media (
  post_id INTEGER NOT NULL,
  media_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_post_media_media ON post_media(media_id);
