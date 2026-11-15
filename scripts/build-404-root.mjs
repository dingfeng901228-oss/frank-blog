#!/usr/bin/env node
/**
 * scripts/build-404-root.mjs
 *
 * Cloudflare Pages serves the ROOT /404.html for every unmatched request.
 * Next.js's static export writes out/404.html from the app's not-found
 * route — but that route sits at app/[locale]/not-found.tsx, so what lands
 * in out/404.html is the DEFAULT Next.js English page with no site chrome.
 *
 * The locale-specific pages ARE built (out/ja/404.html, out/zh/404.html,
 * out/en/404.html) and each one carries the full site layout: Navbar,
 * Footer, the global stylesheet and <html lang="…">.
 *
 * This script promotes the Japanese one to out/404.html. The page itself
 * is a client component that reads window.location.pathname and re-renders
 * in the right language after hydration, so a visitor who mistypes
 * /zh/some-page gets the Chinese 404, not the Japanese one.
 *
 * The only thing that script cannot fix is the <html lang> attribute,
 * which lives OUTSIDE the React tree in the server-rendered HTML — so a
 * tiny inline sniffer sets it before hydration. It also adds `dark` to the
 * html element for the same reason (the class is server-rendered).
 *
 * Runs from postbuild, after next build has written out/.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const TAG = '[build-404-root]';

const SOURCE = join(OUT, 'ja', '404.html');
const TARGET = join(OUT, '404.html');

if (!existsSync(SOURCE)) {
  // Nothing to promote. Not fatal — the default Next 404 will be served —
  // but say so, because a silent no-op here is exactly the bug this
  // script exists to prevent.
  console.warn(`${TAG} ⚠ out/ja/404.html not found — keeping the default 404.`);
  process.exit(0);
}

let html = readFileSync(SOURCE, 'utf8');

// Kept inline and dependency-free: this file is served directly by
// Cloudflare Pages for 404s, so it must not depend on the React bundle
// having loaded. It only fixes attributes that live outside the React
// tree; all visible text is handled by the page's own hydration.
const sniffer = `
<script>
(function () {
  var m = /^\\/(zh|en)(?:\\/|$)/.exec(window.location.pathname);
  var loc = m ? m[1] : 'ja';
  document.documentElement.setAttribute('lang', loc === 'zh' ? 'zh-CN' : loc === 'en' ? 'en' : 'ja');
  document.documentElement.classList.add('dark');
})();
</script>
`;

// Insert the sniffer right before </body> so it runs after the page has
// been parsed.
if (html.includes('</body>')) {
  html = html.replace('</body>', `${sniffer}</body>`);
} else {
  html += sniffer;
}

writeFileSync(TARGET, html, 'utf8');
console.log(
  `${TAG} promoted out/ja/404.html → out/404.html (+ locale sniffer, ${html.length} bytes)`
);
