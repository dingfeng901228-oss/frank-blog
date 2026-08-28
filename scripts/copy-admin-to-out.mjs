#!/usr/bin/env node
/**
 * Copy static admin HTML pages from src/admin/ to out/admin/.
 *
 * Next.js static export (`output: 'export'`) only processes routes under
 * src/app/. The admin pages are static HTML files served at /admin/* that
 * are NOT Next.js routes — they need this explicit copy step to make it
 * into the Cloudflare Pages deployment bundle.
 *
 * Wired up via npm postbuild script — runs automatically after `next build`.
 */
import { cp, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src', 'admin');
const DST = join(ROOT, 'out', 'admin');

const TAG = '[copy-admin]';

if (!existsSync(SRC)) {
  console.log(`${TAG} no src/admin/ — skipping`);
  process.exit(0);
}

if (!existsSync(join(ROOT, 'out'))) {
  console.error(`${TAG} � out/ does not exist — did next build fail?`);
  process.exit(1);
}

await mkdir(DST, { recursive: true });
await cp(SRC, DST, { recursive: true, dereference: true });
console.log(`${TAG} copied ${SRC} → ${DST}`);