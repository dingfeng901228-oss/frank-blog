#!/usr/bin/env node
/**
 * Rewrite image references in .mdx / .md / .tsx / .ts from local paths
 * to Cloudflare R2 URLs.
 *
 * Patterns handled:
 *   1. frontmatter relative paths
 *        coverImage: "/images/foo.png"
 *      →  coverImage: "https://images.frank2025.com/images/foo.webp"
 *
 *   2. inline markdown image refs (absolute, current production domain)
 *        ![alt](https://blog.frank2025.com/images/foo.png)
 *      →  ![alt](https://images.frank2025.com/images/foo.webp)
 *
 *   3. JSX src="..." (root-relative images like avatar.jpg)
 *        src="/avatar.jpg"
 *      →  src="https://images.frank2025.com/avatar.webp"
 *
 * Usage:
 *   node scripts/rewrite-md-references.mjs              # dry-run, prints diff
 *   node scripts/rewrite-md-references.mjs --write     # actually writes files
 *   node scripts/rewrite-md-references.mjs --base <URL>   # override R2 base
 *
 * Scope: all .mdx / .md / .tsx / .ts under repo root, excluding node_modules,
 *        .git, .next, dist, out, build.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const isWrite  = args.includes('--write');
const baseIdx  = args.indexOf('--base');
const R2_BASE  = (baseIdx >= 0 ? args[baseIdx + 1] : 'https://images.frank2025.com').replace(/\/$/, '');
const OLD_HOST = 'blog.frank2025.com';

const EXT_RE     = /\.(png|jpg|jpeg|jfif|webp)$/i;
const EXT_GROUP  = /\.(png|jpg|jpeg|jfif)$/i;
const FM_KEYS    = '(?:coverImage|cover|image|thumbnail|ogImage|featured|hero|banner|photo|avatar)';
const SKIP_DIRS  = new Set(['node_modules', '.git', '.next', 'dist', 'out', 'build', '.turbo']);

function rewriteImageExt(p) {
  return p.replace(EXT_GROUP, '.webp');
}

function rewrite(content) {
  let out = content;
  const changes = [];

  // 1. Frontmatter relative paths: coverImage: "/images/foo.png"
  const fmRe = new RegExp(
    `^(\\s*${FM_KEYS}:\\s*["']?)(\\/images\\/[\\w\\-.\\/]+\\.(?:png|jpg|jpeg|jfif|webp))(["']?\\s*)$`,
    'gim'
  );
  out = out.replace(fmRe, (m, pre, path, suf) => {
    const newPath = `${R2_BASE}${rewriteImageExt(path)}`;
    changes.push({ kind: 'frontmatter', from: path, to: newPath });
    return `${pre}${newPath}${suf}`;
  });

  // 2. Inline markdown image refs with absolute URL
  const mdRe = new RegExp(
    `(!\\[[^\\]]*\\]\\()https?://${OLD_HOST.replace(/\./g, '\\.')}(\\/images\\/[\\w\\-.\\/]+\\.(?:png|jpg|jpeg|jfif))(\\))`,
    'g'
  );
  out = out.replace(mdRe, (m, pre, path, suf) => {
    const newUrl = `${R2_BASE}${rewriteImageExt(path)}`;
    changes.push({ kind: 'inline', from: `${OLD_HOST}${path}`, to: newUrl });
    return `${pre}${newUrl}${suf}`;
  });

  // 3. JSX src="/images/foo.png" or src="/avatar.jpg"
  const jsxRe = new RegExp(
    `(src=["']?)(\\/(?:images|avatar)\\/[\\w\\-.\\/]+\\.(?:png|jpg|jpeg|jfif))(["'])`,
    'g'
  );
  out = out.replace(jsxRe, (m, pre, path, suf) => {
    const newPath = `${R2_BASE}${rewriteImageExt(path)}`;
    changes.push({ kind: 'jsx-src', from: path, to: newPath });
    return `${pre}${newPath}${suf}`;
  });

  // 4. Inline markdown image refs with RELATIVE path (no host, just /images/...)
  //    E.g. ![alt](/images/foo.png) -> ![alt](https://images.frank2025.com/images/foo.webp)
  //    Handles newly-written mdx without absolute URLs (most common pattern in fresh drafts).
  const mdRelRe = new RegExp(
    `(!\\[[^\\]]*\\]\\()(\\/images\\/[\\w\\-.\\/]+\\.(?:png|jpg|jpeg|jfif))(\\))`,
    'g'
  );
  out = out.replace(mdRelRe, (m, pre, path, suf) => {
    const newUrl = `${R2_BASE}${rewriteImageExt(path)}`;
    changes.push({ kind: 'inline-relative', from: path, to: newUrl });
    return `${pre}${newUrl}${suf}`;
  });

  return { out, changes };
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

(async () => {
  console.log(`Mode:   ${isWrite ? 'WRITE' : 'DRY-RUN'}`);
  console.log(`R2:     ${R2_BASE}\n`);

  const targets = [];
  for await (const f of walk(ROOT)) {
    if (/\.(mdx?|tsx?)$/.test(f)) targets.push(f);
  }

  let totalChanges = 0;
  const filesChanged = [];

  for (const file of targets) {
    const content = await readFile(file, 'utf8');
    const { out, changes } = rewrite(content);
    if (changes.length === 0) continue;
    filesChanged.push({ file, changes });
    totalChanges += changes.length;
    if (isWrite) await writeFile(file, out, 'utf8');
  }

  for (const { file, changes } of filesChanged) {
    console.log(`\n${relative(ROOT, file)}  (${changes.length})`);
    for (const c of changes) {
      console.log(`  [${c.kind}]`);
      console.log(`    - ${c.from}`);
      console.log(`    + ${c.to}`);
    }
  }

  console.log(`\n—`);
  console.log(`${totalChanges} change${totalChanges === 1 ? '' : 's'} across ${filesChanged.length} file${filesChanged.length === 1 ? '' : 's'}.`);
  if (!isWrite) console.log(`\n(dry-run: nothing written. Re-run with --write to apply.)`);
})();
