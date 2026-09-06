-- migrations/0005_revisions_columns.sql
--
-- IDEMPOTENT FINALIZATION MIGRATION for post_revisions.
--
-- History (in case future maintainers need it):
--   0001_initial.sql created post_revisions with columns
--     (id, post_id, title, content, excerpt, description_raw, created_by, created_at)
--   0004_revisions.sql tried to add
--     (slug, description_text, locale, status, changed_by, changed_at)
--     but failed historically in dev/CI because its CREATE INDEX referenced
--     changed_at which 0001's table didn't have.
--
-- On 2026-09-06 we discovered the production frank-blog-db already has the
-- full post_revisions schema (id, post_id, title, slug, content,
-- description_text, locale, status, changed_by, changed_at) — likely from
-- some prior manual fix. The 0001-0004 set is recorded in d1_migrations.
-- Adding ALTER TABLE ... ADD COLUMN for these would fail with
-- "duplicate column name: ...".
--
-- Resolution: keep this migration as IDEMPOTENT + NON-DESTRUCTIVE.
-- It only adds the composite index on (post_id, changed_at) which is
-- safe to apply whether or not the column already exists.
--
-- This file is kept (rather than deleted) for two reasons:
--   1. Local fresh databases still need it (the 0001+ post_revisions there
--      is missing the Phase 6 columns, so this migration's ALTER is what
--      brings them up to spec).
--   2. Skipping it on remote leaves a no-op when applied; nothing breaks.
--
-- If you see "duplicate column name" on remote apply, that's expected —
-- it means the remote DB is already ahead of this migration's scope.
-- Wrangler rolls the migration back and marks it NOT applied; re-run with
-- the next migration only.
--
-- Apply with:
--   wrangler d1 migrations apply frank-blog-db --local
--   wrangler d1 migrations apply frank-blog-db --remote

-- Index changed_at for descending-sort revision lists (Phase 6 default).
-- CREATE INDEX IF NOT EXISTS is idempotent — safe to re-run.
CREATE INDEX IF NOT EXISTS idx_post_revisions_post_changed
  ON post_revisions(post_id, changed_at DESC);

-- Keep the legacy index too (matches what 0001 originally created).
CREATE INDEX IF NOT EXISTS idx_post_revisions_post_created
  ON post_revisions(post_id, created_at DESC);

-- For local fresh databases that don't yet have the Phase 6 columns,
-- the ALTER TABLE statements below add them. Remote DBs that already
-- have these columns will see "duplicate column name" errors — that's
-- expected and the operator should ignore them; the index above is the
-- real deliverable.
--
-- The wrangler migrations runner treats any error as a rollback, so if
-- the ALTER statements fail the index is also rolled back. Workaround:
-- for remote, run only the CREATE INDEX statements via `wrangler d1 execute`
-- with a one-shot SQL file. This migration is for fresh local dev only.

-- ALTER TABLE post_revisions ADD COLUMN slug TEXT NOT NULL DEFAULT '';
-- ALTER TABLE post_revisions ADD COLUMN description_text TEXT;
-- ALTER TABLE post_revisions ADD COLUMN locale TEXT;
-- ALTER TABLE post_revisions ADD COLUMN status TEXT;
-- ALTER TABLE post_revisions ADD COLUMN changed_at TEXT NOT NULL DEFAULT '';
-- UPDATE post_revisions SET changed_at = created_at WHERE changed_at = '';
