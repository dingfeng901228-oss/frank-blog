#!/usr/bin/env node
/**
 * scripts/sync-migrations-to-worker-api.mjs
 *
 * Copies migrations/*.sql from repo root → worker-api/migrations/.
 * Why this exists:
 *   - Cloudflare Workers (worker-api/) wrangler v4 looks for migrations/ next
 *     to wrangler.toml when running `wrangler d1 migrations apply`
 *   - ADR-007 says migrations live at repo root (single source of truth)
 *   - This script is the bridge: any time you add a migration to ../migrations,
 *     re-run this BEFORE running `wrangler d1 migrations apply`
 *
 * Idempotent. Run from repo root:
 *   node scripts/sync-migrations-to-worker-api.mjs
 *
 * Also wired into .github/workflows/deploy.yml deploy step
 * (we'll add it later if needed).
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const srcDir = join(repoRoot, 'migrations');
const dstDir = join(repoRoot, 'worker-api', 'migrations');

if (!existsSync(srcDir)) {
  console.error(`❌ Source migrations dir not found: ${srcDir}`);
  process.exit(1);
}

mkdirSync(dstDir, { recursive: true });

const files = readdirSync(srcDir).filter((f) => f.endsWith('.sql'));

let copied = 0;
for (const f of files) {
  const src = join(srcDir, f);
  const dst = join(dstDir, f);
  copyFileSync(src, dst);
  copied++;
}

// Clean up stale .sql files in dst that no longer exist in src
const existing = new Set(files);
let removed = 0;
for (const f of readdirSync(dstDir)) {
  if (f.endsWith('.sql') && !existing.has(f)) {
    unlinkSync(join(dstDir, f));
    removed++;
  }
}

console.log(`✅ Synced ${copied} migration file(s) → worker-api/migrations/`);
if (removed > 0) console.log(`   Removed ${removed} stale file(s).`);
