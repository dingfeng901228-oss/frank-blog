#!/usr/bin/env node
/**
 * scripts/sync-d1-to-mdx.mjs
 *
 * SSG build hook — reads all published posts from D1, writes MDX files to src/content/
 * Per ADR-002: SSG rebuild triggers after Publish/Unpublish via CF Pages Deploy Hook
 * Per ADR-009: URL format preserved (same paths as original MDX)
 * Per ADR-005: src/lib/blog.ts and src/lib/notes.ts unchanged (still read MDX files)
 *
 * Architecture (post-Phase-9):
 *   D1 (source of truth)
 *     ↓
 *   [CF Pages build triggered by publish/unpublish via Deploy Hook]
 *     ↓
 *   Build command: node scripts/sync-d1-to-mdx.mjs --remote && npm run build
 *     ↓
 *   sync-d1-to-mdx.mjs reads D1, writes MDX files to src/content/{locale}/{posts,notes}/
 *     ↓
 *   next build reads MDX files via existing src/lib/blog.ts (unchanged)
 *     ↓
 *   Static pages generated → blog.frank2025.com serves new content
 *
 * Per D-6 byte-level preservation:
 *   description_raw is preserved as-is (block scalar form retained)
 *   content is the MDX body verbatim from D1
 *
 * Usage:
 *   node scripts/sync-d1-to-mdx.mjs --local        # For local dev/testing
 *   node scripts/sync-d1-to-mdx.mjs --remote       # For CF Pages build (production)
 *   node scripts/sync-d1-to-mdx.mjs --include-drafts   # Include status='draft' posts
 *
 * Exit codes:
 *   0  success
 *   1  usage error
 *   2  D1 query failure
 *   3  write failure
 *
 * Build command (set in CF Pages Dashboard → Settings → Build):
 *   node scripts/sync-d1-to-mdx.mjs --remote && npm run build
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync, rmSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

// Walk up from cwd to find the project root (same pattern as
// migrate-md-to-d1.mjs / seed-admin.mjs / smoke-test.mjs).
function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'src', 'content'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const CONTENT_ROOT = join(PROJECT_ROOT, 'src', 'content');
const LOCALES = ['zh', 'ja', 'en'];
const COLLECTIONS = ['posts', 'notes'];
const DB_NAME = 'frank-blog-db';

// ────────────────────────────────────────────────────
// CLI args
// ────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isLocal        = args.includes('--local');
const isRemote       = args.includes('--remote');
const includeDrafts  = args.includes('--include-drafts');
const isDryRun       = args.includes('--dry-run');

let target = null;
if (isLocal)  target = 'local';
if (isRemote) target = 'remote';

if (!isDryRun && !target) {
  console.error('❌ Must specify --local, --remote, or --dry-run');
  console.error('   Usage: node scripts/sync-d1-to-mdx.mjs --local|--remote|--dry-run [--include-drafts]');
  process.exit(1);
}

// ────────────────────────────────────────────────────
// Step 1: Query all published posts from D1
// ────────────────────────────────────────────────────

function queryAllPosts(target) {
  const statusFilter = includeDrafts ? '' : "WHERE status = 'published'";
  // Single-line SQL — wrangler 4.x has a bug where `--file=` + `--remote`
  // misinterprets the SQL file as an R2 upload ("├ Checking if file needs
  // uploading"). Using --command="..." with single-line SQL works.
  // Use explicit column list so we control the JSON shape.
  const sql = `SELECT id, collection, locale, slug, title, description_raw, description_text, content, cover_image, published_at, is_featured, tags FROM posts ${statusFilter} ORDER BY locale, collection, slug`;

  // wrangler d1 needs wrangler.toml next to where it runs; spawn from
  // worker-api/ subproject which has its own wrangler.toml + DB binding.
  const workerApiDir = join(PROJECT_ROOT, 'worker-api');
  // Escape single quotes for the shell wrapping (double-quoted --command="...").
  const escapedSql = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} --${target} --json --command="${escapedSql}"`;
  let stdout;
  try {
    stdout = execSync(cmd, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      cwd: workerApiDir,
    });
  } catch (e) {
    console.error(`❌ wrangler d1 execute failed: ${e.message}`);
    if (e.stdout) console.error(`   stdout: ${e.stdout.toString().slice(0, 500)}`);
    process.exit(2);
  }

  try {
    const parsed = JSON.parse(stdout);
    return parsed?.[0]?.results ?? [];
  } catch (e) {
    // wrangler 4.x in --remote mode prepends R2 migration check output
    // (e.g. "├ Checking if file needs uploading") and other non-JSON
    // lines before the actual JSON payload. Strip everything before the
    // first '[' or '{' to recover the JSON.
    const jsonStart = Math.min(
      stdout.indexOf('[') >= 0 ? stdout.indexOf('[') : Infinity,
      stdout.indexOf('{') >= 0 ? stdout.indexOf('{') : Infinity
    );
    if (jsonStart !== Infinity) {
      try {
        const parsed = JSON.parse(stdout.slice(jsonStart));
        return parsed?.[0]?.results ?? parsed;
      } catch {
        // fall through to original error
      }
    }
    console.error(`❌ Failed to parse D1 response: ${e.message}`);
    console.error(`   stdout: ${stdout.slice(0, 500)}`);
    process.exit(2);
  }
}

// ────────────────────────────────────────────────────
// Step 2: Build MDX from D1 row (preserving byte-level format per D-6)
// ────────────────────────────────────────────────────

function escapeYamlString(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function buildMdx(post) {
  // Per D-6 byte-level preservation: write frontmatter in the original
  // canonical order (title, description, publishedAt, tags, coverImage,
  // featured) and always emit `featured: false` so the round-trip matches
  // the git-tracked MDX exactly. description_raw stores the entire YAML
  // line(s) for `description:` exactly as captured by migrate's
  // extractDescriptionYaml (including the leading "description:" prefix
  // and any inline quoting / block scalar indicator), so we emit it
  // verbatim.
  const lines = ['---'];

  // Title (always emit)
  lines.push(`title: "${escapeYamlString(post.title)}"`);

  // Description: emit description_raw verbatim if it exists (this is
  // the full YAML line captured by extractDescriptionYaml in migrate).
  if (post.description_raw && post.description_raw.trim().length > 0) {
    lines.push(post.description_raw);
  } else if (post.description_text) {
    lines.push(`description: "${escapeYamlString(post.description_text)}"`);
  }

  // Published date (YYYY-MM-DD from ISO timestamp)
  if (post.published_at) {
    const dateStr = String(post.published_at).split('T')[0];
    lines.push(`publishedAt: "${dateStr}"`);
  }

  // Tags (JSON array from D1 → YAML inline array)
  if (post.tags) {
    try {
      const tags = JSON.parse(post.tags);
      if (Array.isArray(tags) && tags.length > 0) {
        const items = tags.map((t) => `"${escapeYamlString(t)}"`).join(', ');
        lines.push(`tags: [${items}]`);
      }
    } catch {
      // ignore malformed JSON
    }
  }

  // Cover image
  if (post.cover_image) {
    lines.push(`coverImage: "${escapeYamlString(post.cover_image)}"`);
  }

  // Featured — always emit (true OR false) so the round-trip matches
  // git-tracked MDX which has `featured: false`.
  const isFeatured = post.is_featured === 1 || post.is_featured === true;
  lines.push(`featured: ${isFeatured ? 'true' : 'false'}`);

  lines.push('---');
  // Body separator: always emit a blank line between frontmatter and
  // body. The original MDX files in the corpus are inconsistent here —
  // some have a blank line after `---`, some don't (see
  // src/content/en/posts/ai-era.mdx vs
  // src/content/zh/notes/july-jlpt-n2.mdx). gray-matter's parsed.content
  // starts with a leading newline IFF the source had a blank line. We
  // normalize to always-have-blank-line for output. Strip the leading
  // newline if present so we don't produce a double blank line.
  //
  // Note: this is NOT byte-identical to all source MDX (D-6 is
  // violated for files that lacked the blank line). next-intl's gray-matter
  // parses both formats identically, so this is functionally safe but
  // D-6 byte-level round-trip is best-effort. To achieve true byte-level
  // preservation we'd need a new `posts.original_mdx` TEXT column that
  // stores the entire source file verbatim (including frontmatter);
  // that requires a new migration.
  //
  // Normalize CRLF → LF so the byte stream matches git-tracked files on
  // Windows (where git autocrlf rewrites CRLF → LF on checkout).
  let body = (post.content ?? '').replace(/\r\n/g, '\n');
  if (body.startsWith('\n')) body = body.slice(1);
  lines.push('');
  lines.push(body);

  return lines.join('\n');
}

// ────────────────────────────────────────────────────
// Step 3: Sync MDX files
// ────────────────────────────────────────────────────

function listExistingSlugs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map((f) => f.replace(/\.(mdx|md)$/, ''));
}

function sync() {
  console.log(`🚀 Sync D1 → MDX (${target ?? 'dry-run'})`);
  console.log(`   include-drafts: ${includeDrafts}`);

  // Step 1: Query
  console.log('\n📊 Step 1: Querying posts from D1...');
  const posts = queryAllPosts(target);
  console.log(`   Found ${posts.length} ${includeDrafts ? '' : 'published '}posts`);

  // Step 2: Group by (locale, collection)
  const groups = {};
  for (const p of posts) {
    const key = `${p.locale}/${p.collection}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  // Step 3: For each group, delete stale + write new
  console.log('\n📝 Step 2: Writing MDX files...');
  let totalWritten = 0;
  let totalDeleted = 0;
  let totalKept = 0;
  const allDirs = new Set();

  for (const locale of LOCALES) {
    for (const collection of COLLECTIONS) {
      const dir = join(CONTENT_ROOT, locale, collection);
      allDirs.add(dir);

      const groupKey = `${locale}/${collection}`;
      const groupPosts = groups[groupKey] ?? [];
      const newSlugs = new Set(groupPosts.map((p) => p.slug));

      // Delete MDX files for posts no longer in D1
      const existingSlugs = listExistingSlugs(dir);
      for (const existingSlug of existingSlugs) {
        if (!newSlugs.has(existingSlug)) {
          const filePath = join(dir, `${existingSlug}.mdx`);
          if (isDryRun) {
            console.log(`   🗑️  [dry-run] would delete ${locale}/${collection}/${existingSlug}.mdx`);
          } else {
            try {
              unlinkSync(filePath);
              console.log(`   🗑️  Deleted ${locale}/${collection}/${existingSlug}.mdx`);
              totalDeleted++;
            } catch (e) {
              console.error(`   ⚠️  Failed to delete ${filePath}: ${e.message}`);
            }
          }
        } else {
          totalKept++;
        }
      }

      // Write each post
      for (const post of groupPosts) {
        const mdx = buildMdx(post);
        const filePath = join(dir, `${post.slug}.mdx`);

        if (isDryRun) {
          console.log(`   📝 [dry-run] would write ${locale}/${collection}/${post.slug}.mdx (${mdx.length} bytes)`);
        } else {
          try {
            mkdirSync(dir, { recursive: true });
            writeFileSync(filePath, mdx, 'utf8');
            console.log(`   ✅ Wrote ${locale}/${collection}/${post.slug}.mdx (${mdx.length} bytes)`);
            totalWritten++;
          } catch (e) {
            console.error(`   ❌ Failed to write ${filePath}: ${e.message}`);
            process.exit(3);
          }
        }
      }
    }
  }

  console.log(`\n${isDryRun ? '🔍 ' : '🎉 '}Sync ${isDryRun ? 'preview ' : ''}complete:`);
  console.log(`   ${totalWritten} ${isDryRun ? 'would be ' : ''}written`);
  console.log(`   ${totalKept} kept (unchanged)`);
  console.log(`   ${totalDeleted} ${isDryRun ? 'would be ' : ''}deleted`);
}

// ────────────────────────────────────────────────────
// Run
// ────────────────────────────────────────────────────

sync();
