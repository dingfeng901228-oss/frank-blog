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
import { join, relative } from 'node:path';

const CONTENT_ROOT = join(process.cwd(), 'src', 'content');
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
  const sql = `SELECT id, collection, locale, slug, title, description_raw, description_text,
                       content, cover_image, published_at, is_featured, tags
                FROM posts
                ${statusFilter}
                ORDER BY locale, collection, slug`;

  const cmd = `npx wrangler d1 execute ${DB_NAME} --${target} --json --command="${sql.replace(/"/g, '\\"')}"`;
  let stdout;
  try {
    stdout = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    console.error(`❌ wrangler d1 execute failed: ${e.message}`);
    if (e.stdout) console.error(`   stdout: ${e.stdout.toString().slice(0, 500)}`);
    process.exit(2);
  }

  try {
    const parsed = JSON.parse(stdout);
    return parsed?.[0]?.results ?? [];
  } catch (e) {
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
  const lines = ['---'];
  let descRawUsed = false;

  // Description: prefer description_raw (preserves block scalar per D-6),
  // fallback to single-line quoted description_text
  if (post.description_raw && post.description_raw.trim().length > 0) {
    // description_raw is the YAML lines for description (extracted from original frontmatter).
    // If it already starts with 'description:', write verbatim.
    if (post.description_raw.startsWith('description:')) {
      lines.push(post.description_raw);
      descRawUsed = true;
    } else {
      // Defensive: prefix with 'description:'
      lines.push(`description: ${post.description_raw}`);
      descRawUsed = true;
    }
  } else if (post.description_text) {
    lines.push(`description: "${escapeYamlString(post.description_text)}"`);
  }

  // Title (only add if not already in description_raw block)
  if (!descRawUsed || !post.description_raw.includes('title:')) {
    lines.push(`title: "${escapeYamlString(post.title)}"`);
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

  // Featured
  if (post.is_featured === 1 || post.is_featured === true) {
    lines.push('featured: true');
  }

  lines.push('---', '');
  lines.push(post.content ?? '');

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
