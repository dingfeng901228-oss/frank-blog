#!/usr/bin/env node
/**
 * R2 pre-commit hook — auto-upload staged new images to R2 + update mdx refs.
 *
 * Workflow:
 *   git add public/images/foo.png
 *   git commit -m "..."
 *   → hook runs:
 *     1. sharp compress + upload foo.png to R2 as foo.webp
 *     2. update mdx frontmatter / inline refs to R2 URL (.webp)
 *     3. git add -u .   (stage the mdx changes)
 *     4. git rm foo.png (remove from index + working tree)
 *
 * Bypass:  SKIP_R2_HOOK=1 git commit ...
 *
 * Required env (loaded from .env.local at repo root, gitignored):
 *   R2_ACCOUNT_ID          — 32-hex CF Account ID
 *   R2_ACCESS_KEY_ID       — R2 S3 access key
 *   R2_SECRET_ACCESS_KEY   — R2 S3 secret
 *
 * Token setup:
 *   CF Dashboard → R2 → Manage R2 API Tokens → Create
 *   Permissions: Object Read & Write (scope: frank-blog-assets bucket only)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const CWD = process.cwd();

function loadEnvLocal() {
  const envPath = resolve(CWD, '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function git(args) {
  return execSync(`git ${args}`, { cwd: CWD, encoding: 'utf8' });
}

loadEnvLocal();

if (process.env.SKIP_R2_HOOK === '1') {
  console.log('⚠ SKIP_R2_HOOK=1, skipping R2 hook');
  process.exit(0);
}

for (const envName of REQUIRED_ENV) {
  if (!process.env[envName]) {
    console.error(`❌ Missing env: ${envName}`);
    console.error(`   Add to .env.local (gitignored), or run: SKIP_R2_HOOK=1 git commit ...`);
    process.exit(1);
  }
}

// Find staged new/modified images in public/images/
let stagedImages;
try {
  stagedImages = git("diff --cached --name-only --diff-filter=AM -- public/images/")
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && /\.(png|jpg|jpeg|jfif)$/i.test(s));
} catch (e) {
  console.error(`❌ git diff failed: ${e.message}`);
  process.exit(1);
}

if (stagedImages.length === 0) {
  console.log('R2 hook: no staged images, nothing to do');
  process.exit(0);
}

console.log(`R2 hook: ${stagedImages.length} staged image(s)`);

// 1. Upload each image to R2 as WebP (via existing migrate-to-r2.mjs)
for (const img of stagedImages) {
  console.log(`  → ${img}`);
  try {
    execSync(`node scripts/migrate-to-r2.mjs --file "${img}"`, {
      cwd: CWD,
      stdio: 'inherit',
      env: process.env,
    });
  } catch (e) {
    console.error(`  ❌ Upload failed: ${img}`);
    console.error(`     Set SKIP_R2_HOOK=1 to bypass for this commit`);
    process.exit(1);
  }
}

// 2. Update mdx refs to R2 URLs (existing script handles all 3 patterns)
console.log('Updating mdx refs to R2 URLs...');
try {
  execSync('node scripts/rewrite-md-references.mjs --write', {
    cwd: CWD,
    stdio: 'inherit',
    env: process.env,
  });
} catch (e) {
  console.error(`❌ mdx rewrite failed: ${e.message}`);
  process.exit(1);
}

// 3. Stage mdx changes (rewrite writes to working tree, not index)
try {
  git('add -u .');
} catch (e) {
  console.error(`❌ git add failed: ${e.message}`);
  process.exit(1);
}

// 4. Remove local images (from index + working tree — they live in R2 now).
//    Track actual successful rm vs unstage-only for accurate reporting.
let removedCount = 0;
let unstageOnlyCount = 0;
for (const img of stagedImages) {
  try {
    git(`rm -- "${img}"`);
    removedCount++;
  } catch {
    // File may not be in index (already committed + modified); just unstage
    git(`reset HEAD -- "${img}"`);
    unstageOnlyCount++;
  }
}

let summary = `✓ R2 hook: ${stagedImages.length} image(s) uploaded, mdx refs updated, ${removedCount} local file(s) removed`;
if (unstageOnlyCount > 0) summary += `, ${unstageOnlyCount} unstage-only (not in index)`;
console.log(summary);
