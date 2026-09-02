#!/usr/bin/env node
/**
 * scripts/migrate-md-to-d1.mjs
 *
 * Migrate existing MDX files from src/content/* to D1 posts table.
 * Per ADR-008 7-step workflow + ADR-006 (MVP scope):
 *   1. Backup            — Copy src/content/ to backups/migration-{ts}/
 *   2. Dry Run           — Show what would be inserted (no writes)
 *   3. Count Check       — MDX file count vs D1 record count
 *   4. Data Validation   — Each MDX has required fields (title, slug, etc.)
 *   5. Import            — UPSERT all posts via wrangler d1 execute --file=
 *   6. Random Verify     — Pick N random, compare MDX content ↔ D1 content byte-for-byte
 *   7. Production Switch — Manual (caller responsibility, see ADR-008)
 *
 * Per D-6 byte-level preservation:
 *   - description_raw stores the ORIGINAL YAML for description (block scalar preserved)
 *   - description_text stores the parsed plain string for SEO meta / queries
 *   - content stores the MDX body verbatim (after gray-matter strips frontmatter)
 *
 * Idempotent:
 *   - ON CONFLICT(collection, locale, slug) DO UPDATE SET ... (UPSERT)
 *   - Re-running updates existing posts with new content
 *
 * Usage:
 *   node scripts/migrate-md-to-d1.mjs --dry-run [--verbose]
 *   node scripts/migrate-md-to-d1.mjs --local
 *   node scripts/migrate-md-to-d1.mjs --remote
 *   node scripts/migrate-md-to-d1.mjs --verify-only
 *
 * Exit codes:
 *   0  — success
 *   1  — usage error
 *   2  — validation failure
 *   3  — D1 query failure
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import matter from 'gray-matter';

const CONTENT_ROOT = join(process.cwd(), 'src', 'content');
const BACKUP_ROOT = join(process.cwd(), 'backups');
const LOCALES = ['zh', 'ja', 'en'];
const COLLECTIONS = ['posts', 'notes'];
const DB_NAME = 'frank-blog-db';
const VERIFY_SAMPLE_SIZE = 5;

// ────────────────────────────────────────────────────
// CLI arg parsing
// ────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun     = args.includes('--dry-run');
const isLocal      = args.includes('--local');
const isRemote     = args.includes('--remote');
const isVerifyOnly = args.includes('--verify-only');
const isVerbose    = args.includes('--verbose') || args.includes('-v');

let target = null;
if (isLocal)  target = 'local';
if (isRemote) target = 'remote';

if (!isDryRun && !isVerifyOnly && !target) {
  console.error('❌ Must specify --local, --remote, --dry-run, or --verify-only');
  console.error('   Usage: node scripts/migrate-md-to-d1.mjs [--local|--remote|--dry-run|--verify-only]');
  process.exit(1);
}

// ────────────────────────────────────────────────────
// Step 1 + 2: Walk + Parse MDX files
// ────────────────────────────────────────────────────

function walkMdxFiles() {
  const files = [];
  for (const locale of LOCALES) {
    for (const collection of COLLECTIONS) {
      const dir = join(CONTENT_ROOT, locale, collection);
      if (!existsSync(dir)) continue;
      for (const entry of readdirSync(dir)) {
        if (!entry.endsWith('.mdx') && !entry.endsWith('.md')) continue;
        const filePath = join(dir, entry);
        const stat = statSync(filePath);
        if (!stat.isFile()) continue;
        const slug = entry.replace(/\.(mdx|md)$/, '');
        files.push({ filePath, locale, collection, slug, size: stat.size });
      }
    }
  }
  return files;
}

/**
 * Extract original description YAML from raw MDX file content (D-6 byte-level).
 * Handles block scalar (>) and folded (|) and single-line (") formats.
 */
function extractDescriptionYaml(rawFile) {
  const match = rawFile.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return '';

  const yaml = match[1];
  const lines = yaml.split(/\r?\n/);
  const out = [];
  let inDesc = false;

  for (const line of lines) {
    if (line.match(/^description\s*:/)) {
      inDesc = true;
      out.push(line);
    } else if (inDesc) {
      // Block scalar continuation lines start with whitespace
      if (line.match(/^[ \t]/) || line === '') {
        out.push(line);
      } else {
        // New top-level key, description done
        inDesc = false;
      }
    }
  }
  return out.join('\n');
}

function parseMdxFile(file) {
  const raw = readFileSync(file.filePath, 'utf8');
  const parsed = matter(raw, { language: 'yaml' });
  const fm = parsed.data || {};

  // Normalize frontmatter keys (some MDX uses camelCase, others kebab-case)
  const title       = fm.title ?? '';
  const publishedAt = fm.publishedAt ?? fm.published_at ?? '';
  const tags        = Array.isArray(fm.tags) ? fm.tags : [];
  const coverImage  = fm.coverImage ?? fm.cover_image ?? '';
  const featured    = fm.featured === true || fm.featured === 'true';
  const excerpt     = fm.excerpt ?? '';
  const readingTime = fm.readingTime ?? fm.reading_time ?? '';

  return {
    collection: file.collection,
    locale:     file.locale,
    slug:       file.slug,
    title:      String(title).trim() || file.slug,
    description_raw:  extractDescriptionYaml(raw),
    description_text: String(fm.description ?? ''),
    content:     parsed.content,
    content_format: file.filePath.endsWith('.md') ? 'md' : 'mdx',
    excerpt:     excerpt || null,
    cover_image: coverImage || null,
    status:      'published', // existing posts are assumed already on production
    published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date(file.filePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date()).toISOString(),
    reading_time: readingTime || null,
    is_featured: featured ? 1 : 0,
    tags:        tags.length > 0 ? JSON.stringify(tags) : null,
    rawSize:     raw.length,
    contentSize: parsed.content.length,
  };
}

// ────────────────────────────────────────────────────
// Step 3: Backup (only for --local / --remote)
// ────────────────────────────────────────────────────

function backupMdxFiles() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = join(BACKUP_ROOT, `migration-${ts}`);
  mkdirSync(dest, { recursive: true });
  cpSync(CONTENT_ROOT, dest, { recursive: true });
  console.log(`💾 Backup created: ${relative(process.cwd(), dest)}`);
  return dest;
}

// ────────────────────────────────────────────────────
// Step 4: Data Validation
// ────────────────────────────────────────────────────

function validatePosts(posts) {
  const errors = [];
  for (const p of posts) {
    if (!p.title)               errors.push(`${p.collection}/${p.locale}/${p.slug}: missing title`);
    if (!p.slug)                errors.push(`${p.collection}/${p.locale}: missing slug`);
    if (!p.description_text)    errors.push(`${p.collection}/${p.locale}/${p.slug}: missing description`);
    if (!LOCALES.includes(p.locale))           errors.push(`${p.slug}: invalid locale '${p.locale}'`);
    if (!COLLECTIONS.includes(p.collection))    errors.push(`${p.slug}: invalid collection '${p.collection}'`);
    if (!p.content || p.content.length < 10)    errors.push(`${p.collection}/${p.locale}/${p.slug}: content too short`);
  }
  // Check for duplicate (collection, locale, slug) within source
  const seen = new Set();
  for (const p of posts) {
    const key = `${p.collection}/${p.locale}/${p.slug}`;
    if (seen.has(key)) errors.push(`Duplicate key: ${key}`);
    seen.add(key);
  }
  return errors;
}

// ────────────────────────────────────────────────────
// Step 5: Build SQL + Import
// ────────────────────────────────────────────────────

function sqlEscape(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildUpsertSql(posts) {
  const values = posts.map(p => `(
    ${sqlEscape(p.collection)},
    ${sqlEscape(p.locale)},
    ${sqlEscape(p.slug)},
    ${sqlEscape(p.title)},
    ${sqlEscape(p.description_raw)},
    ${sqlEscape(p.description_text)},
    ${sqlEscape(p.content)},
    ${sqlEscape(p.content_format)},
    ${sqlEscape(p.excerpt)},
    ${sqlEscape(p.cover_image)},
    ${sqlEscape(p.status)},
    ${sqlEscape(p.published_at)},
    NULL,
    ${sqlEscape(p.reading_time)},
    ${p.is_featured},
    ${sqlEscape(p.tags)}
  )`).join(',\n');

  return `INSERT INTO posts (
    collection, locale, slug, title,
    description_raw, description_text, content, content_format,
    excerpt, cover_image, status, published_at,
    author_id, reading_time, is_featured, tags
  ) VALUES
${values}
ON CONFLICT(collection, locale, slug) DO UPDATE SET
  title            = excluded.title,
  description_raw  = excluded.description_raw,
  description_text = excluded.description_text,
  content          = excluded.content,
  content_format   = excluded.content_format,
  excerpt          = excluded.excerpt,
  cover_image      = excluded.cover_image,
  status           = excluded.status,
  published_at     = excluded.published_at,
  updated_at       = datetime('now'),
  reading_time     = excluded.reading_time,
  is_featured      = excluded.is_featured,
  tags             = excluded.tags;
`;
}

function runImport(posts, target) {
  // D1 SQL statement limit is ~100 KB. Use 32 KB to leave headroom for escape
  // expansion and INSERT/UPSERT boilerplate (ADR-008 §5: chunked import).
  const MAX_SQL_BYTES = 32 * 1024;

  console.log(`\n📥 Importing ${posts.length} posts to ${target} D1...`);
  console.log(`   Strategy: chunked UPSERT, max ${MAX_SQL_BYTES / 1024} KB per statement (D1 limit ~100 KB)`);

  let batch = [];
  let batchBytes = 0;
  let batchIndex = 0;
  let totalImported = 0;

  for (const post of posts) {
    // Measure each post's SQL footprint individually — large posts (>~25 KB
    // content) will be the first ones flushed to their own batch.
    const sql = buildUpsertSql([post]);
    const sqlBytes = Buffer.byteLength(sql, 'utf8');

    if (batch.length > 0 && batchBytes + sqlBytes > MAX_SQL_BYTES) {
      totalImported += flushBatch(batch, target, ++batchIndex);
      batch = [];
      batchBytes = 0;
    }
    batch.push(post);
    batchBytes += sqlBytes;
  }

  if (batch.length > 0) {
    totalImported += flushBatch(batch, target, ++batchIndex);
  }

  console.log(`\n✅ Imported ${totalImported}/${posts.length} posts across ${batchIndex} batch(es)`);
}

function flushBatch(batch, target, batchIndex) {
  const sql = buildUpsertSql(batch);
  const tmpFile = join(process.cwd(), `.migration-${Date.now()}-b${batchIndex}.sql`);
  writeFileSync(tmpFile, sql, 'utf8');
  try {
    const result = withRetrySync((attempt) => {
      if (attempt === 1) {
        console.log(`  📦 Batch ${batchIndex}: ${batch.length} posts, ${(Buffer.byteLength(sql, 'utf8') / 1024).toFixed(1)} KB`);
      } else {
        console.log(`  🔄 Batch ${batchIndex}: retry attempt ${attempt}/${RETRY_OPTIONS.maxAttempts}`);
      }
      execSync(`npx wrangler d1 execute ${DB_NAME} --${target} --file="${tmpFile}"`, {
        stdio: 'inherit',
      });
      return batch.length;
    }, { label: `flushBatch #${batchIndex}` });
    rmSync(tmpFile); // clean up on success
    return result;
  } catch (e) {
    console.error(`❌ Batch ${batchIndex} failed after ${RETRY_OPTIONS.maxAttempts} attempts: ${e.message}`);
    console.error(`   Failing SQL preserved at: ${tmpFile} (not removed for inspection)`);
    throw e;
  }
}

// ────────────────────────────────────────────────────
// Retry helper (handles transient wrangler API hiccups)
// ────────────────────────────────────────────────────

const RETRY_OPTIONS = {
  maxAttempts: 4,
  baseDelayMs: 2000, // exponential: 2s, 4s, 8s, 16s
};

function sleepSync(ms) {
  // Node has no native sync sleep; Atomics.wait on a SharedArrayBuffer works.
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

function withRetrySync(fn, opts = {}) {
  const {
    maxAttempts = RETRY_OPTIONS.maxAttempts,
    baseDelayMs = RETRY_OPTIONS.baseDelayMs,
    label = 'op',
  } = opts;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return fn(attempt);
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      const errMsg = String(e.message ?? e).split('\n')[0];
      console.warn(`⚠️ ${label} attempt ${attempt}/${maxAttempts} failed: ${errMsg}`);
      console.warn(`   Retrying in ${delay}ms...`);
      sleepSync(delay);
    }
  }
  throw lastError;
}

// ────────────────────────────────────────────────────
// Step 6: Random Verification (read back from D1, compare)
// ────────────────────────────────────────────────────

function d1Query(sql, target) {
  return withRetrySync((attempt) => {
    if (attempt > 1) {
      console.log(`  🔄 d1Query retry attempt ${attempt}/${RETRY_OPTIONS.maxAttempts}`);
    }
    const out = execSync(`npx wrangler d1 execute ${DB_NAME} --${target} --command="${sql.replace(/"/g, '\\"')}" --json`, {
      encoding: 'utf8',
    });
    return JSON.parse(out)?.[0]?.results ?? [];
  }, { label: 'd1Query' });
}

function verifyRandomSample(posts, target) {
  const sample = pickSample(posts, VERIFY_SAMPLE_SIZE);
  console.log(`\n🔍 Random verification (${sample.length} posts)...`);

  let pass = 0;
  let fail = 0;
  for (const post of sample) {
    const rows = d1Query(
      `SELECT title, description_text, content FROM posts WHERE collection='${post.collection}' AND locale='${post.locale}' AND slug='${post.slug}'`,
      target
    );
    if (rows.length === 0) {
      console.error(`  ❌ ${post.collection}/${post.locale}/${post.slug}: not found in D1`);
      fail++;
      continue;
    }
    const row = rows[0];
    const titleOk       = row.title === post.title;
    const descOk        = row.description_text === post.description_text;
    // content comparison: D1 stores content (MDX body), post.content should match
    const contentOk     = row.content === post.content;
    const allOk         = titleOk && descOk && contentOk;

    if (allOk) {
      console.log(`  ✅ ${post.collection}/${post.locale}/${post.slug}: title / desc / content byte-identical`);
      pass++;
    } else {
      console.error(`  ❌ ${post.collection}/${post.locale}/${post.slug}:`);
      if (!titleOk)   console.error(`     title mismatch: D1="${row.title}" vs MDX="${post.title}"`);
      if (!descOk)    console.error(`     description mismatch`);
      if (!contentOk) console.error(`     content mismatch (D1: ${row.content.length} bytes vs MDX: ${post.content.length} bytes)`);
      fail++;
    }
  }
  console.log(`\n  Result: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

function pickSample(posts, n) {
  const shuffled = [...posts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, posts.length));
}

function d1Count(target) {
  const rows = d1Query(`SELECT COUNT(*) as n FROM posts`, target);
  return rows[0]?.n ?? 0;
}

// ────────────────────────────────────────────────────
// Main workflow
// ────────────────────────────────────────────────────

async function main() {
  console.log('🚀 frank-blog CMS — MDX → D1 Migration');
  console.log(`   Mode: ${isDryRun ? 'DRY RUN' : isVerifyOnly ? 'VERIFY ONLY' : `APPLY (${target})`}`);

  // Step 1: Walk MDX files
  console.log('\n📂 Step 1: Walking MDX files...');
  const files = walkMdxFiles();
  console.log(`   Found ${files.length} MDX files in ${LOCALES.length} locales × ${COLLECTIONS.length} collections`);
  if (isVerbose) {
    for (const f of files) {
      console.log(`     ${f.collection}/${f.locale}/${f.slug} (${f.size} bytes)`);
    }
  }

  // Step 2: Parse all files
  console.log('\n🔍 Step 2: Parsing MDX + extracting frontmatter...');
  const posts = files.map(parseMdxFile);
  console.log(`   Parsed ${posts.length} posts (description_raw + description_text extracted per D-6)`);

  // Step 4: Data validation
  console.log('\n✅ Step 4: Data validation...');
  const errors = validatePosts(posts);
  if (errors.length > 0) {
    console.error(`   ❌ ${errors.length} validation errors:`);
    for (const e of errors) console.error(`     - ${e}`);
    process.exit(2);
  }
  console.log(`   All ${posts.length} posts passed validation`);

  // Step 1 (backup) — only for apply mode
  if (target) {
    console.log('\n💾 Step 1b: Backup src/content/ before import...');
    backupMdxFiles();
  }

  // Step 3: Count check
  console.log('\n📊 Step 3: Count check...');
  if (target || isVerifyOnly) {
    const d1N = d1Count(target ?? 'local');
    console.log(`   MDX files: ${files.length}    D1 posts: ${d1N}    Delta: ${files.length - d1N}`);
  } else {
    console.log(`   MDX files: ${files.length}    D1 posts: (skipped — dry run)`);
  }

  // Dry Run — show sample and exit
  if (isDryRun) {
    console.log('\n🔍 DRY RUN — no writes performed');
    console.log('\nSample (first 3 posts):');
    for (const p of posts.slice(0, 3)) {
      console.log(`\n  ${p.collection}/${p.locale}/${p.slug}`);
      console.log(`    title:         ${p.title.slice(0, 60)}${p.title.length > 60 ? '…' : ''}`);
      console.log(`    description:   ${p.description_text.slice(0, 60)}${p.description_text.length > 60 ? '…' : ''}`);
      console.log(`    cover_image:   ${p.cover_image ?? '(none)'}`);
      console.log(`    published_at:  ${p.published_at}`);
      console.log(`    featured:      ${p.is_featured === 1 ? 'yes' : 'no'}`);
      console.log(`    tags:          ${p.tags ?? '(none)'}`);
      console.log(`    content bytes: ${p.contentSize}`);
    }
    console.log(`\nTo apply: re-run with --local (or --remote for production)`);
    process.exit(0);
  }

  // Verify Only — read back from D1 and compare
  if (isVerifyOnly) {
    console.log('\n🔍 Step 6: Random verification against D1...');
    const t = target ?? 'local';
    const ok = verifyRandomSample(posts, t);
    if (!ok) {
      console.error('❌ Verification FAILED');
      process.exit(3);
    }
    console.log('\n✅ All sampled posts verified byte-identical against D1');
    process.exit(0);
  }

  // Step 5: Import
  console.log('\n📥 Step 5: Import (UPSERT to D1)...');
  runImport(posts, target);

  // Step 6: Verify
  console.log('\n🔍 Step 6: Random verification...');
  const ok = verifyRandomSample(posts, target);
  if (!ok) {
    console.error('❌ Verification FAILED after import');
    console.error('   Check the failed posts above and re-run with --local to retry');
    process.exit(3);
  }

  // Step 7: Production switch (manual)
  console.log('\n✅ Step 7: Production switch (manual)');
  console.log('   1. Verify all posts are in D1 (curl http://localhost:8788/api/admin/posts)');
  console.log('   2. git add -A src/content && git commit -m "migrate MDX to D1"');
  console.log('   3. (optional) delete src/content/ once SSG renders correctly from D1');
  console.log('   4. Phase 9 wires SSG rebuild to read from D1');
  console.log('\n🎉 Migration complete.');
}

main().catch((e) => {
  console.error('❌ Fatal:', e.message);
  console.error(e.stack);
  process.exit(1);
});
