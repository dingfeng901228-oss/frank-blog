#!/usr/bin/env node
/**
 * postbuild step — materialise out/index.html from out/ja.html.
 *
 * The blog is served at a locale prefix (/ja, /en, /zh); there is no page at
 * the root path. Cloudflare Pages needs a real file at out/index.html or the
 * bare domain 404s, so we copy the Japanese homepage there as the fallback.
 *
 * This used to be a bare `cp out/ja.html out/index.html` step in the GitHub
 * Actions workflow only — meaning a build triggered any other way (the
 * Cloudflare Pages deploy hook the CMS fires on publish) produced a deploy
 * with no root page. Doing it in Node here keeps it portable and puts it on
 * every build path, alongside the other postbuild copies.
 */

import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'out', 'ja.html');
const DST = join(ROOT, 'out', 'index.html');
const TAG = '[copy-root-index]';

if (!existsSync(SRC)) {
  console.error(`${TAG} ✗ out/ja.html is missing — did the site build fail?`);
  process.exit(1);
}

copyFileSync(SRC, DST);
console.log(`${TAG} out/ja.html → out/index.html`);
