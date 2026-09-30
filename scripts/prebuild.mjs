#!/usr/bin/env node
/**
 * prebuild — everything that must exist BEFORE `next build` runs.
 *
 * Runs automatically via the `prebuild` npm hook, so it executes for ANY
 * `npm run build`: the GitHub Actions workflow, the Cloudflare Pages deploy
 * hook the CMS fires on publish, and a plain local build.
 *
 * Order matters:
 *   1. admin SPA   → admin/out/    postbuild's copy-admin-spa.mjs merges this
 *                                  into out/admin/. That script now HARD-FAILS
 *                                  when admin/out/ is missing, so this step is
 *                                  mandatory, not optional.
 *   2. D1 → MDX    → src/content/  D1 is the source of truth for posts
 *                                  (ADR-002), so a post published from the
 *                                  CMS has to be materialised as MDX before
 *                                  the site renders.
 *
 * WHY THIS EXISTS
 * ---------------
 * The admin SPA build used to live only in .github/workflows/deploy.yml. The
 * Cloudflare Pages deploy hook — which the CMS Worker calls on every publish
 * or edit — runs nothing but the project's build command, so those builds
 * never produced `admin/out/`. copy-admin-spa.mjs then hit its
 * "no admin/out/ — skipping" branch and exited 0, so the deploy SUCCEEDED
 * with no /admin at all and silently replaced the good deployment. That is
 * the mechanism behind the recurring "blog.frank2025.com/admin 页面不存在".
 *
 * Keeping the whole pipeline here means every builder produces the same,
 * complete output — and a build that cannot produce it fails loudly instead.
 *
 * Env:
 *   SKIP_D1_SYNC=1   skip the D1 → MDX sync (offline / MDX-only builds)
 *   SKIP_ADMIN_BUILD=1  reuse an existing admin/out/ (fast local iteration)
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN = join(ROOT, 'admin');
const TAG = '[prebuild]';

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

// ── 1. admin SPA ─────────────────────────────────────────────────────────
if (process.env.SKIP_ADMIN_BUILD === '1' && existsSync(join(ADMIN, 'out'))) {
  console.log(`${TAG} SKIP_ADMIN_BUILD=1 and admin/out/ exists — reusing it`);
} else {
  if (!existsSync(join(ADMIN, 'node_modules'))) {
    console.log(`${TAG} installing admin dependencies…`);
    run('npm ci --no-audit --no-fund', ADMIN);
  }
  console.log(`${TAG} building admin SPA…`);
  run('npm run build', ADMIN);
}
if (!existsSync(join(ADMIN, 'out'))) {
  console.error(`${TAG} ✗ admin build produced no admin/out/ — refusing to continue.`);
  console.error(`${TAG}   Without it the deploy would silently ship without /admin.`);
  process.exit(1);
}

// ── 2. D1 → src/content/*.mdx ────────────────────────────────────────────
if (process.env.SKIP_D1_SYNC === '1') {
  console.log(`${TAG} SKIP_D1_SYNC=1 — building from the committed MDX as-is`);
} else {
  console.log(`${TAG} syncing D1 → src/content/…`);
  try {
    run('node scripts/sync-d1-to-mdx.mjs --remote');
  } catch (err) {
    // Deliberately fatal. A silently-skipped sync would ship a site missing
    // whatever was just published — the same class of silent breakage as the
    // admin SPA. Set SKIP_D1_SYNC=1 if you really want an offline build.
    console.error(`${TAG} ✗ D1 → MDX sync failed.`);
    console.error(`${TAG}   Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID,`);
    console.error(`${TAG}   or a logged-in wrangler. Use SKIP_D1_SYNC=1 to bypass.`);
    process.exit(1);
  }
}

console.log(`${TAG} done`);
