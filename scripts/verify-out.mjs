#!/usr/bin/env node
/**
 * scripts/verify-out.mjs
 *
 * Checks the static export in out/ before it goes live. Run it after
 * `npm run build`:
 *
 *     npm run build && node scripts/verify-out.mjs
 *
 * WHAT IT CHECKS
 * --------------
 *   1. every internal link resolves to a file in out/
 *   2. no literal ** markers survived the markdown renderer
 *   3. no ISO date is visible in the text (the site-wide format is
 *      「2026年9月30日」 / "September 30, 2026")
 *   4. the RSS feeds carry every article and no 「✏️ 」 prefix
 *   5. the root 404.html is the in-site page, not Next's bare default
 *   6. no English chrome is left on the Japanese pages
 *   7. no simplified-Chinese-only character is left on the Japanese pages
 *
 * WHY THE DECODING IN (1) AND THE TAG STRIPPING IN (3)/(5)
 * --------------------------------------------------------
 *   Cloudflare Pages decodes the request path before it looks for a
 *   file, and the export writes the DECODED name ("Japanese study.html"),
 *   so a link has to be decoded before it can be compared with the tree.
 *
 *   In (3) and (5) the HTML tags are stripped first: an ISO date inside
 *   <time datetime="2026-09-30"> is correct, and "This page could not
 *   be found" survives inside Next's RSC flight payload even when the
 *   visible page is the in-site 404.
 *
 * THE LEAK SCAN IN (7)
 * --------------------
 *   A simplified-Chinese-only character is one that appears in the zh
 *   corpus but nowhere in the ja corpus (content AND the interface
 *   strings in src/). Grepping for Chinese words does not work — most
 *   Chinese characters are valid Japanese kanji too — and a character
 *   that merely happens to be absent from the ja corpus (概, 索, 石 …)
 *   is a false positive, which is why the interface strings are added
 *   to the ja set.
 *
 * Exit code 1 when something is wrong, so CI can gate on it.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const SRC = join(ROOT, 'src');
const TAG = '[verify-out]';

if (!existsSync(OUT)) {
  console.error(`${TAG} ✗ out/ does not exist — run npm run build first.`);
  process.exit(1);
}

const problems = [];
const notes = [];

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(OUT);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
console.log(`${TAG} out/: ${files.length} files, ${htmlFiles.length} html\n`);

// ── 1. every internal href resolves ───────────────────────────────────────
const LINK = /href="([^"]+)"/g;
let checked = 0;
const missing = new Set();
for (const f of htmlFiles) {
  // out/_admin/ is the legacy rollback copy of the old CMS (ADR-003).
  if (f.includes(`${OUT}\\_admin`) || f.includes(`${OUT}/_admin`)) continue;
  const text = readFileSync(f, 'utf8');
  let m;
  LINK.lastIndex = 0;
  while ((m = LINK.exec(text)) !== null) {
    let href = m[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    href = href.split('#')[0].split('?')[0];
    if (!href || href === '/') continue;
    if (/\.(js|css|json|xml|txt|png|jpg|jpeg|webp|svg|ico|woff2?|webmanifest)$/i.test(href)) continue;
    checked++;
    let rel = href.replace(/^\//, '');
    try { rel = decodeURIComponent(rel); } catch { /* keep raw */ }
    const candidates = [join(OUT, rel), join(OUT, rel, 'index.html'), join(OUT, rel + '.html')];
    if (!candidates.some((c) => existsSync(c))) missing.add(`${relative(OUT, f)}  ->  ${href}`);
  }
}
console.log(`[1] internal links checked: ${checked}`);
if (missing.size) {
  problems.push(`[1] ${missing.size} broken internal links`);
  for (const x of [...missing].slice(0, 40)) console.log('    MISSING: ' + x);
} else notes.push('[1] every internal link resolves');

// ── 2. no literal ** left ─────────────────────────────────────────────────
let stars = 0;
for (const f of htmlFiles.filter((p) => /\\(blog|notes)\\/.test(p))) {
  const body = readFileSync(f, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
  const hits = body.match(/\*\*[^*\n]{1,40}\*\*/g);
  if (hits) {
    stars += hits.length;
    console.log(`    [2] ${relative(OUT, f)}: ${hits.slice(0, 3).join(' | ')}`);
  }
}
console.log(`[2] literal ** markers left: ${stars}`);
if (stars) problems.push(`[2] ${stars} literal ** markers`);

// ── 3. no ISO date visible ────────────────────────────────────────────────
const ISO = /\d{4}-\d{2}-\d{2}/g;
let isoHits = 0;
for (const f of htmlFiles.filter((p) => /\\(blog|notes)\\/.test(p))) {
  const body = readFileSync(f, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ');
  const hits = body.match(ISO);
  if (hits) {
    isoHits += hits.length;
    console.log(`    [3] ${relative(OUT, f)}: ${[...new Set(hits)].slice(0, 4).join(' ')}`);
  }
}
console.log(`[3] ISO dates visible in the text: ${isoHits}`);
if (isoHits) problems.push(`[3] ${isoHits} ISO dates visible`);

// ── 4. RSS ────────────────────────────────────────────────────────────────
for (const loc of ['ja', 'zh', 'en']) {
  const p = join(OUT, loc, 'rss.xml');
  if (!existsSync(p)) { problems.push(`[4] missing ${loc}/rss.xml`); continue; }
  const xml = readFileSync(p, 'utf8');
  const items = (xml.match(/<item>/g) || []).length;
  const pencil = xml.includes('✏️');
  console.log(`[4] ${loc}/rss.xml items=${items} pencil=${pencil}`);
  if (pencil) problems.push(`[4] ${loc} rss still has the ✏️ prefix`);
}

// ── 5. the root 404 page is the in-site one ──────────────────────────────
{
  const text = readFileSync(join(OUT, '404.html'), 'utf8');
  const visible = text
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ');
  const hasNav = /Frank/.test(visible);
  const hasFooter = /タグ一覧|标签索引|Tags/.test(visible);
  const hasHome = /ホームへ戻る|返回首页|Back to home/.test(visible);
  const isNext = /This page could not be found/.test(visible);
  const lang = (text.match(/<html[^>]*lang="([^"]+)"/) || [])[1];
  console.log(`[5] root 404: nav=${hasNav} footer=${hasFooter} homeLink=${hasHome} nextDefault=${isNext} lang=${lang}`);
  if (!hasNav || !hasFooter || !hasHome || isNext) problems.push('[5] root 404 is not the in-site page');
}

// ── 6. English chrome on the Japanese pages ───────────────────────────────
const UI_PATTERNS = [
  'ON THIS PAGE', 'On this page', 'Table of Contents', 'Read more', 'Related posts',
  'Share', 'Copy link', 'Published', 'Reading Time', 'Back to top', 'All entries',
  'By year', 'By month',
];
let enHits = 0;
for (const f of htmlFiles.filter((p) => /[\\/]ja[\\/]/.test(p))) {
  const body = readFileSync(f, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
  for (const pat of UI_PATTERNS) {
    if (body.includes(pat)) { enHits++; console.log(`    [6] ${relative(OUT, f)}: "${pat}"`); }
  }
}
console.log(`[6] English UI strings in ja pages: ${enHits}`);
if (enHits) problems.push(`[6] ${enHits} English UI strings in ja pages`);

// ── 7. simplified-Chinese-only characters on the Japanese pages ───────────
{
  const charset = (dir, srcToo = false) => {
    const s = new Set();
    for (const f of walk(dir)) {
      if (!/\.(mdx|md)$/.test(f)) continue;
      for (const c of readFileSync(f, 'utf8')) s.add(c);
    }
    if (srcToo) {
      for (const f of walk(SRC)) {
        if (!/\.(tsx?|jsx?)$/.test(f)) continue;
        if (f.includes(`${SRC}\\content`) || f.includes(`${SRC}/content`)) continue;
        for (const c of readFileSync(f, 'utf8')) s.add(c);
      }
    }
    return s;
  };
  const zh = charset(join(SRC, 'content', 'zh'));
  const ja = charset(join(SRC, 'content', 'ja'), true);
  const leak = new Set([...zh].filter((c) => !ja.has(c) && /[㐀-鿿]/.test(c)));
  let leaks = 0;
  for (const f of htmlFiles.filter((p) => /[\\/]ja[\\/]/.test(p))) {
    const body = readFileSync(f, 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '');
    for (const c of new Set(body)) {
      if (leak.has(c)) { leaks++; console.log(`    [7] ${relative(OUT, f)}: [${c}]`); }
    }
  }
  console.log(`[7] simplified-only chars in ja pages: ${leaks}`);
  if (leaks) problems.push(`[7] ${leaks} simplified-only chars in ja pages`);
}

console.log('\n=== PROBLEMS ===');
if (problems.length === 0) {
  console.log('none');
  console.log(notes.map((n) => '  ' + n).join('\n'));
  process.exit(0);
}
problems.forEach((p) => console.log('  ' + p));
process.exit(1);
