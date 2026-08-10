#!/usr/bin/env node
/**
 * CF Pages build-time R2 image sync.
 *
 * Runs as part of CF Pages build command (prepended to existing build).
 * Idempotent: scans public/images/, uploads any files NOT yet on R2,
 * rewrites mdx/tsx refs to R2 URLs, removes uploaded originals from
 * working tree so Next.js build doesn't copy them to output.
 *
 * Purpose: catches Dashboard "Upload image:" commits that bypass the
 * local husky pre-commit hook — every CF build re-checks R2 freshness.
 *
 * CF Dashboard setup (one-time, manual):
 *   Settings → Environment variables:
 *     R2_ACCOUNT_ID
 *     R2_ACCESS_KEY_ID
 *     R2_SECRET_ACCESS_KEY
 *   Settings → Build configuration:
 *     Build command: node scripts/sync-images-to-r2-build.mjs && <original-build>
 *
 * Usage:
 *   node scripts/sync-images-to-r2-build.mjs            # build mode
 *   node scripts/sync-images-to-r2-build.mjs --dry-run  # preview only
 *
 * Required env (CF Pages env vars; for local testing use .env.local + manual export):
 *   R2_ACCOUNT_ID          — 32-hex CF Account ID
 *   R2_ACCESS_KEY_ID       — R2 S3 access key
 *   R2_SECRET_ACCESS_KEY   — R2 S3 secret
 */

import sharp from 'sharp';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readdir, readFile, unlink } from 'fs/promises';
import { join, basename, extname, relative } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

const R2_BUCKET = process.env.R2_BUCKET        || 'frank-blog-assets';
const R2_BASE   = (process.env.R2_PUBLIC_BASE  || 'https://images.frank2025.com').replace(/\/$/, '');
const R2_ACCOUNT = process.env.R2_ACCOUNT_ID;
const R2_ACCESS  = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET  = process.env.R2_SECRET_ACCESS_KEY;

const SUPPORTED = /\.(png|jpg|jpeg|jfif)$/i;
const TAG = '[build-r2-sync]';

if (!R2_ACCOUNT || !R2_ACCESS || !R2_SECRET) {
  console.error(`${TAG} ❌ Missing R2 credentials. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in env.`);
  console.error(`   (local: export from .env.local; CF Pages: set in Dashboard env vars)`);
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS, secretAccessKey: R2_SECRET },
});

async function existsInR2(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return; // public/images/ may not exist
    throw e;
  }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function optimize(buf) {
  return sharp(buf)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

async function upload(key, body) {
  if (isDryRun) return;
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function processFile(file) {
  const buf = await readFile(file);
  const origKB = Math.round(buf.length / 1024);
  const webp = await optimize(buf);
  const newKB = Math.round(webp.length / 1024);
  const rel = relative(join(ROOT, 'public'), file).replace(/\\/g, '/');
  const key = `images/${basename(rel, extname(rel))}.webp`;
  const exists = await existsInR2(key);
  if (!exists) await upload(key, webp);
  return { key, url: `${R2_BASE}/${key}`, origKB, newKB, exists };
}

(async () => {
  console.log(`${TAG} mode=${isDryRun ? 'DRY-RUN' : 'UPLOAD'} bucket=${R2_BUCKET} base=${R2_BASE}`);

  const files = [];
  for await (const f of walk(join(ROOT, 'public/images'))) {
    if (SUPPORTED.test(f)) files.push(f);
  }
  console.log(`${TAG} found ${files.length} candidate image(s) in public/images/`);

  let uploaded = 0, skipped = 0, failed = 0;
  const uploadedFiles = [];
  for (const f of files) {
    try {
      const r = await processFile(f);
      if (r.exists) {
        skipped++;
        console.log(`  · ${r.key} (already on R2, skip)`);
      } else {
        uploaded++;
        uploadedFiles.push(f);
        const pct = r.origKB === 0 ? 0 : Math.round((1 - r.newKB / r.origKB) * 100);
        console.log(`  ✓ ${r.key.padEnd(50)} ${r.origKB}KB → ${r.newKB}KB (-${pct}%)`);
      }
    } catch (e) {
      failed++;
      console.error(`  � ${relative(ROOT, f)}: ${e.message}`);
    }
  }

  if (failed > 0) {
    console.error(`${TAG} ${failed} upload failure(s) — aborting build`);
    process.exit(1);
  }

  if (uploaded === 0) {
    console.log(`${TAG} nothing new to upload (${skipped} already on R2)`);
  } else {
    console.log(`${TAG} ${uploaded} uploaded, ${skipped} skipped`);
  }

  // Always rewrite mdx/tsx refs to R2 URLs (idempotent — runs every build).
  console.log(`${TAG} rewriting mdx/tsx refs to R2 URLs...`);
  if (!isDryRun) {
    try {
      execSync('node scripts/rewrite-md-references.mjs --write', {
        cwd: ROOT,
        stdio: 'inherit',
      });
    } catch (e) {
      console.error(`${TAG} ❌ mdx rewrite failed — aborting build`);
      console.error(`   Source mdx may have malformed image refs. Fix and re-push.`);
      process.exit(1);
    }

    // Remove uploaded originals from working tree so Next.js doesn't copy them.
    if (uploaded > 0) {
      console.log(`${TAG} removing ${uploaded} uploaded original(s) from working tree...`);
      for (const f of uploadedFiles) {
        try { await unlink(f); } catch { /* ignore — Next.js will skip missing files */ }
      }
    }
  }

  console.log(`${TAG} done`);
})();
