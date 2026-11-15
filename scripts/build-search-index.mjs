#!/usr/bin/env node
/**
 * scripts/build-search-index.mjs
 *
 * Writes out/search-index.json — the data behind the site-wide search.
 *
 * The index holds, for every locale, the title / description / tags / URL
 * of every published blog post and note. It is generated at build time
 * from the MDX that next build has already produced, so it can never drift
 * from what the site actually serves.
 *
 * The search runs entirely in the browser against this one file: no
 * server, no third-party service, no API key.
 *
 * Runs from postbuild, after next build has written out/.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const CONTENT = join(ROOT, 'src', 'content');
const TAG = '[build-search-index]';

const LOCALES = ['ja', 'zh', 'en'];

/**
 * Pull the frontmatter fields we need out of an .mdx file without
 * depending on gray-matter here — the file's frontmatter is simple
 * YAML, and the build already validated it via next build.
 */
function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return {};
  const block = match[1];
  const out = {};

  const title = /^title:\s*"(.*)"\s*$/m.exec(block);
  if (title) out.title = title[1];

  const desc = /^description:\s*"(.*)"\s*$/m.exec(block);
  if (desc) out.description = desc[1];
  else {
    // Block scalar form:
    //   description: >
    //     line one
    //     line two
    const blockDesc = /^description:\s*>\s*\n((?:\s+.*\n?)+)/m.exec(block);
    if (blockDesc) {
      out.description = blockDesc[1]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ');
    }
  }

  const tags = /^tags:\s*\[(.*)\]\s*$/m.exec(block);
  if (tags) {
    out.tags = tags[1]
      .split(',')
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  return out;
}

const entries = {};

for (const locale of LOCALES) {
  const list = [];
  for (const [collection, dirName] of [
    ['posts', 'blog'],
    ['notes', 'notes'],
  ]) {
    const dir = join(CONTENT, locale, collection);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
      const full = join(dir, file);
      if (!statSync(full).isFile()) continue;
      const slug = file.replace(/\.(mdx|md)$/, '');
      const source = readFileSync(full, 'utf8');
      const fm = parseFrontmatter(source);
      list.push({
        title: fm.title ?? slug,
        description: fm.description ?? '',
        tags: fm.tags ?? [],
        url: `/${locale}/${dirName}/${slug}`,
        kind: collection === 'notes' ? 'note' : 'post',
      });
    }
  }
  entries[locale] = list;
}

const index = {
  generatedAt: new Date().toISOString(),
  entries,
};

const target = join(OUT, 'search-index.json');
writeFileSync(target, JSON.stringify(index), 'utf8');

const total = Object.values(entries).reduce((n, l) => n + l.length, 0);
console.log(
  `${TAG} wrote out/search-index.json — ${total} entries across ${LOCALES.length} locales`
);
