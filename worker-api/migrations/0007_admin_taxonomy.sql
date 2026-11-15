-- migrations/0007_admin_taxonomy.sql
-- Admin CMS — taxonomy (tags + categories), scheduling, and log detail.
--
-- WHY THIS MIGRATION EXISTS
-- ------------------------
-- The admin SPA had three features whose backing schema was either
-- missing or half-built:
--
--   1. /admin/categories/ failed with
--      "D1_ERROR: no such column: collection". The `categories` table was
--      created by 0001_initial.sql WITHOUT the `collection` column, but
--      0003_categories_tags.sql re-created it WITH one — and SQLite's
--      "CREATE TABLE IF NOT EXISTS" is a no-op when the table already
--      exists, so the production table kept the 0001 shape. The Worker
--      queried the 0003 shape.
--
--   2. The tag system was never populated: `tags` was empty while every
--      article carried its tags as a JSON array in `posts.tags`. The
--      admin tag page therefore showed "共 0 个标签".
--
--   3. `admin_logs` had no column for a failure message, so a failed
--      deploy could be listed but not explained.
--
-- It also adds the columns the admin needs for categories, scheduled
-- publishing and per-post SEO fields.
--
-- EVERY STATEMENT HERE IS IDEMPOTENT OR ADDITIVE. No existing row is
-- modified or deleted, so this migration does not change any article.
--
-- Apply with:
--   wrangler d1 migrations apply frank-blog-db --remote

-- ── 1. categories.collection ─────────────────────────────────────────────
-- A category belongs to one collection (博客 / 随笔), which is what the
-- admin UI's two sections show. Existing rows default to 'posts'.
ALTER TABLE categories ADD COLUMN collection TEXT NOT NULL DEFAULT 'posts';

CREATE INDEX IF NOT EXISTS idx_categories_collection ON categories(collection);

-- ── 2. posts.category_id ────────────────────────────────────────────────
-- One category per post. The join table `post_category` already exists
-- (0003) with a UNIQUE(post_id); this column makes the lookup a plain
-- indexed read instead of a join on every list request.
ALTER TABLE posts ADD COLUMN category_id INTEGER;

-- ── 3. posts.scheduled_at ───────────────────────────────────────────────
-- Scheduled publishing. A post with a future `scheduled_at` stays a
-- draft until the Worker's cron trigger publishes it. The status column
-- has a CHECK constraint that only allows draft/published/archived, so
-- "scheduled" is expressed as status='draft' + a scheduled_at in the
-- future rather than a fourth status value.
ALTER TABLE posts ADD COLUMN scheduled_at TEXT;

-- ── 4. posts.seo_title / posts.og_image ─────────────────────────────────
-- Item 13 — independent SEO title and OG image. og_image falls back to
-- cover_image when it is not set.
ALTER TABLE posts ADD COLUMN seo_title TEXT;
ALTER TABLE posts ADD COLUMN og_image TEXT;

-- ── 5. admin_logs.message ───────────────────────────────────────────────
-- Item 15 — a failed deploy has to show WHAT failed, not just that
-- something did.
ALTER TABLE admin_logs ADD COLUMN message TEXT;

-- ── 6. Seed the tag system from the tags the articles already carry ─────
-- `posts.tags` is a JSON array of strings. D1 ships SQLite with the
-- JSON1 extension, so json_each() can walk it.
--
-- The tag's `slug` is set to the tag NAME, deliberately:
--
--   The public site builds its tag pages as
--       /<locale>/<collection>/tag/<encodeURIComponent(tagName)>
--   so the path segment IS the encoded tag name. If the CMS stored a
--   different slug, the two systems would disagree about the URL and
--   every tag created in the admin would 404 on the public site. Using
--   the name as the slug makes the two rules the same rule.
--
-- The name is what the front-end renders, so it stays human-readable.
INSERT OR IGNORE INTO tags (name, slug, created_at)
SELECT DISTINCT
  j.value            AS name,
  j.value            AS slug,
  datetime('now')    AS created_at
FROM posts, json_each(posts.tags) AS j
WHERE posts.tags IS NOT NULL
  AND posts.tags <> ''
  AND posts.tags <> '[]'
  AND j.value IS NOT NULL
  AND TRIM(j.value) <> '';

-- ── 7. Fill the post_tags join so the admin can count usage ─────────────
INSERT OR IGNORE INTO post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM posts AS p
JOIN json_each(p.tags) AS j
JOIN tags AS t ON t.name = j.value
WHERE p.tags IS NOT NULL
  AND p.tags <> ''
  AND p.tags <> '[]';

-- ── 8. Keep post_category in step with posts.category_id ────────────────
INSERT OR IGNORE INTO post_category (post_id, category_id)
SELECT id, category_id FROM posts WHERE category_id IS NOT NULL;
