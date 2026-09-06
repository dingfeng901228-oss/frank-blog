#!/usr/bin/env node
/**
 * Copy admin SPA static export into the main blog's out/ bundle.
 *
 * Phase 11: collapse frank-blog-cms (separate Pages project) into the main
 * frank-blog Pages project so the entire CMS — UI + API — lives under
 * blog.frank2025.com (with /admin/* serving the SPA and /api/admin/*
 * routed to the existing frank-blog-cms-api Worker).
 *
 * Source: admin/out/         (output of `next build` in admin/)
 * Target: out/               (output of `next build` in root)
 *
 * Path remapping (Next export quirk):
 *
 *   Next's static export emits a layout that doesn't line up with Pages'
 *   directory-index semantics. The mapping below produces a tree Pages can
 *   serve naturally — every URL → a directory containing index.html (and
 *   its RSC sibling .txt), no _redirects shim required.
 *
 *   Next export                    Pages serves              → out/
 *   ──────────────────────────     ─────────────────         ─────────────────
 *   admin/out/admin.html           /admin                    → out/admin/index.html
 *   admin/out/admin.txt            /admin.txt (RSC payload)  → out/admin.txt
 *   admin/out/admin/login.html     /admin/login              → out/admin/login/index.html
 *   admin/out/admin/login.txt      /admin/login.txt          → out/admin/login.txt
 *   admin/out/admin/blog/new.html  /admin/blog/new           → out/admin/blog/new/index.html
 *   admin/out/admin/blog/new.txt   /admin/blog/new.txt       → out/admin/blog/new.txt
 *   admin/out/admin/404.html       /admin/404 (unused)       → out/admin/404/index.html
 *   admin/out/404.html             /404 (admin SPA's own)    → out/admin/404.html
 *
 *   For .html and .txt we compute `routePath` by stripping the literal
 *   leading 'admin/' from the path inside admin/out/. The result IS the
 *   URL route; for .html we additionally place it inside `<route>/index.html`
 *   so Pages' directory-index logic finds it.
 *
 * _next/ handling:
 *   Both next builds emit content-hashed chunks. We merge admin's chunks
 *   into out/_next/ — same filenames (sha-based) imply same content, and
 *   the admin HTML references `/_next/static/...` (absolute), which Pages
 *   resolves against out/_next/. No path rewriting needed.
 *
 * Wired up via npm postbuild (root package.json) so it runs after
 * `cd admin && npm run build` and root `next build` both complete.
 */
import { cp, mkdir, rm, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'admin', 'out');
const DST = join(ROOT, 'out');
const DST_ADMIN = join(DST, 'admin');

const TAG = '[copy-admin-spa]';

if (!existsSync(SRC)) {
  console.log(`${TAG} no admin/out/ — skipping (run \`cd admin && npm run build\` first)`);
  process.exit(0);
}

if (!existsSync(DST)) {
  console.error(`${TAG} ⚠ out/ does not exist — did root next build fail?`);
  process.exit(1);
}

// Wipe any previous admin/ from a prior deploy to keep out/ clean.
await rm(DST_ADMIN, { recursive: true, force: true });
await mkdir(DST_ADMIN, { recursive: true });

/**
 * Compute the URL route from the URL-style relative path of the html
 * (POSIX-style — always forward-slash, regardless of host OS — because we
 * compare against the literal prefix `admin/`).
 *
 *   ''              → ''              (the /admin index, from admin.html)
 *   'admin'         → ''              (the /admin index, ALSO from admin.html)
 *   'admin/login'   → 'login'
 *   'admin/blog/x'  → 'blog/x'
 */
function routeFromFullPath(fullPath) {
  if (fullPath === '' || fullPath === 'admin') return '';
  if (fullPath.startsWith('admin/')) return fullPath.slice('admin/'.length);
  return fullPath;
}

/** Build a POSIX-style relative path (forward slashes, NOT OS native). */
function posixRel(...parts) {
  return parts.filter((p) => p !== '').join('/');
}

async function copyWithRemap(srcDir, relPosix = '') {
  for (const name of await readdir(srcDir)) {
    const srcFull = join(srcDir, name);
    const st = await stat(srcFull);
    const childPosix = posixRel(relPosix, name);

    if (st.isDirectory()) {
      if (name === '_next') continue; // merged separately
      await copyWithRemap(srcFull, childPosix);
      continue;
    }

    const dotIdx = name.lastIndexOf('.');
    const ext = dotIdx === -1 ? '' : name.slice(dotIdx);
    const stem = dotIdx === -1 ? name : name.slice(0, dotIdx);

    if (ext === '.html') {
      // fullPath = relPosix/<stem> — POSIX so the prefix match works.
      const fullPath = posixRel(relPosix, stem);
      const route = routeFromFullPath(fullPath);
      // Pages serves directory paths via index.html.
      //   /admin       (route='')     → out/admin/index.html
      //   /admin/login (route='login')→ out/admin/login/index.html
      const dstFull = join(DST_ADMIN, route, 'index.html');
      await mkdir(dirname(dstFull), { recursive: true });
      await cp(srcFull, dstFull, { dereference: true });
    } else if (ext === '.txt') {
      // RSC payload — Next fetches `<route>.txt` next to the HTML.
      //   /admin        → out/admin.txt
      //   /admin/login  → out/admin/login.txt
      const fullPath = posixRel(relPosix, stem);
      const route = routeFromFullPath(fullPath);
      const dstFull = join(
        DST_ADMIN,
        route ? posixRel(route, `${stem}.txt`) : `${stem}.txt`
      );
      await mkdir(dirname(dstFull), { recursive: true });
      await cp(srcFull, dstFull, { dereference: true });
    } else if (['.json', '.xml', '.webmanifest'].includes(ext)) {
      // Rare in admin/out. Keep as-is under their relative path.
      const dstFull = join(DST_ADMIN, ...childPosix.split('/'));
      await mkdir(dirname(dstFull), { recursive: true });
      await cp(srcFull, dstFull, { dereference: true });
    }
    // Binary / unknown ext: skip (admin SPA has no other assets in /admin/out/).
  }
}

await copyWithRemap(SRC);

// Merge admin/out/_next/ into out/_next/ (shared, content-hashed).
const adminNextDir = join(SRC, '_next');
const outNextDir = join(DST, '_next');
if (existsSync(adminNextDir)) {
  await cp(adminNextDir, outNextDir, { recursive: true, dereference: true });
}

console.log(`${TAG} copied admin SPA → out/admin/ + merged _next/ chunks into out/_next/`);
