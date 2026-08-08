#!/usr/bin/env node
/**
 * Migrate public/images/ to Cloudflare R2.
 * - Converts PNG/JPG/JPEG/JFIF → WebP (q=80, max width 1920px, no enlargement)
 * - Uploads via R2 S3-compatible API
 * - Supports --dry-run (stats only, no upload) and --file <path> (single image)
 *
 * Setup (one-time):
 *   cd your-blog-repo
 *   npm i -D sharp @aws-sdk/client-s3
 *   # Set R2 API token (Object Read & Write, scoped to bucket):
 *   #   Cloudflare Dashboard → R2 → Manage R2 API Tokens
 *   $env:R2_ACCOUNT_ID        = "your-cf-account-id"
 *   $env:R2_ACCESS_KEY_ID     = "your-access-key"
 *   $env:R2_SECRET_ACCESS_KEY = "your-secret-key"
 *   $env:R2_BUCKET            = "frank-blog-assets"   # optional, default shown
 *   $env:R2_PUBLIC_BASE       = "https://images.frank2025.com"   # optional
 *
 * Usage:
 *   node scripts/migrate-to-r2.mjs --dry-run                # preview compression, no upload
 *   node scripts/migrate-to-r2.mjs                          # upload all images in public/images/
 *   node scripts/migrate-to-r2.mjs --file public/images/foo.png   # single image
 *   node scripts/migrate-to-r2.mjs --src public             # also handle avatar.jpg, etc.
 *   node scripts/migrate-to-r2.mjs --no-optimize            # upload as-is, no WebP conversion
 */

import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdir, readFile } from 'fs/promises';
import { join, basename, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const isDryRun   = args.includes('--dry-run');
const noOptimize = args.includes('--no-optimize');
const fileIdx    = args.indexOf('--file');
const singleFile = fileIdx >= 0 ? args[fileIdx + 1] : null;
const srcIdx     = args.indexOf('--src');
const srcDir     = srcIdx  >= 0 ? args[srcIdx  + 1] : 'public/images';

const R2_BUCKET    = process.env.R2_BUCKET       || 'frank-blog-assets';
const R2_BASE      = (process.env.R2_PUBLIC_BASE || 'https://images.frank2025.com').replace(/\/$/, '');
const R2_ACCOUNT   = process.env.R2_ACCOUNT_ID;
const R2_ACCESS    = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET    = process.env.R2_SECRET_ACCESS_KEY;

const SUPPORTED = /\.(png|jpg|jpeg|jfif)$/i;

if (!isDryRun && (!R2_ACCOUNT || !R2_ACCESS || !R2_SECRET)) {
  console.error('❌ Missing R2 credentials. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY');
  console.error('   (or use --dry-run to preview without uploading)');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS, secretAccessKey: R2_SECRET },
});

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
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
  const buf   = await readFile(file);
  const origKB = Math.round(buf.length / 1024);
  const webp   = noOptimize ? buf : await optimize(buf);
  const newKB  = Math.round(webp.length / 1024);
  const rel    = relative(join(ROOT, 'public'), file).replace(/\\/g, '/');
  const key    = `images/${basename(rel, extname(rel))}.webp`;
  await upload(key, webp);
  return { key, url: `${R2_BASE}/${key}`, origKB, newKB };
}

(async () => {
  console.log(`Mode:      ${isDryRun ? 'DRY-RUN' : 'UPLOAD'}`);
  console.log(`Source:    ${srcDir}`);
  console.log(`Bucket:    ${R2_BUCKET}`);
  console.log(`Public:    ${R2_BASE}`);
  if (noOptimize) console.log(`Optimize:  OFF (uploading as-is)`);
  console.log('');

  let files;
  if (singleFile) {
    files = [join(ROOT, singleFile)];
  } else {
    files = [];
    for await (const f of walk(join(ROOT, srcDir))) {
      if (SUPPORTED.test(f)) files.push(f);
    }
  }

  console.log(`Found ${files.length} files\n`);

  let totalOrig = 0, totalNew = 0, ok = 0, fail = 0;
  for (const f of files) {
    try {
      const r = await processFile(f);
      totalOrig += r.origKB;
      totalNew  += r.newKB;
      const pct = r.origKB === 0 ? 0 : Math.round((1 - r.newKB / r.origKB) * 100);
      console.log(`  ✓ ${r.key.padEnd(60)} ${String(r.origKB).padStart(5)}KB → ${String(r.newKB).padStart(5)}KB  (-${pct}%)`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${relative(ROOT, f)}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n${ok} ok, ${fail} fail`);
  console.log(`Total: ${(totalOrig / 1024).toFixed(2)} MB → ${(totalNew / 1024).toFixed(2)} MB  (-${totalOrig ? Math.round((1 - totalNew / totalOrig) * 100) : 0}%)`);
  if (isDryRun) console.log('\n(dry-run: nothing uploaded. Drop --dry-run to actually upload.)');
})();
