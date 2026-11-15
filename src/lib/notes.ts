import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { Post, PostFrontmatter } from './types'
import type { Locale } from '@/i18n/config'
import { readingTimeFor } from './reading-time'
import { normalizeTags } from './tags'

const notesDirectory = (locale: Locale) =>
  path.join(process.cwd(), 'src', 'content', locale, 'notes')

/**
 * Every tag the site knows about, across all locales.
 *
 * Shared with src/lib/blog.ts, but the two content trees are separate, so
 * the notes tree is scanned on its own.
 */
let knownTagsCache: Set<string> | null = null

function knownTags(): Set<string> {
  if (knownTagsCache) return knownTagsCache

  const set = new Set<string>()
  for (const locale of ['ja', 'zh', 'en'] as Locale[]) {
    const dir = notesDirectory(locale)
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      if (!/\.(mdx|md)$/.test(file)) continue
      const raw = fs.readFileSync(path.join(dir, file), 'utf8')
      const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
      if (!block) continue
      const line = /^tags:\s*\[(.*)\]\s*$/m.exec(block[1])
      if (!line) continue
      for (const entry of line[1].split(',')) {
        const tag = entry.trim().replace(/^["']|["']$/g, '').trim()
        if (tag) set.add(tag)
      }
    }
  }

  knownTagsCache = set
  return set
}

export function getNoteSlugs(locale: Locale): string[] {
  const dir = notesDirectory(locale)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map((f) => f.replace(/\.(mdx|md)$/, ''))
}

export function getNoteBySlug(locale: Locale, slug: string): Post | null {
  const fullPath = path.join(notesDirectory(locale), `${slug}.mdx`)
  const fullPathMd = path.join(notesDirectory(locale), `${slug}.md`)

  let filePath = fullPath
  if (!fs.existsSync(fullPath) && fs.existsSync(fullPathMd)) {
    filePath = fullPathMd
  }
  if (!fs.existsSync(filePath)) return null

  const fileContents = fs.readFileSync(filePath, 'utf8')
  // Force `language: 'yaml'` to bypass gray-matter's first-line language detection
  // (same fix as src/lib/blog.ts: under Next 15 webpack bundling the detection can
  // capture the YAML's first data line as a phantom engine name and throw
  // "engine ... is not registered").
  const { data, content } = matter(fileContents, { language: 'yaml' })
  const frontmatter = data as PostFrontmatter

  return {
    slug,
    content,
    // Notes used to carry no reading time at all, which is why the reading
    // time only appeared on articles. It is computed from the content,
    // exactly like a post's, so the two list pages agree.
    readingTime: readingTimeFor(content, locale),
    ...frontmatter,
    tags: normalizeTags(frontmatter.tags, knownTags()),
  }
}

export function getAllNotes(locale: Locale): Post[] {
  const slugs = getNoteSlugs(locale)
  const notes = slugs
    .map((slug) => getNoteBySlug(locale, slug))
    .filter((p): p is Post => p !== null)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  return notes
}

export function getNotes(locale: Locale): Post[] {
  return getAllNotes(locale)
}

export function getAllNoteTags(locale: Locale): string[] {
  const notes = getAllNotes(locale)
  const tagSet = new Set<string>()
  notes.forEach((note) => {
    note.tags?.forEach((tag) => tagSet.add(tag))
  })
  return Array.from(tagSet).sort()
}

/**
 * Find up to `limit` other notes that share at least one tag with the
 * given note, ranked by shared-tag count and then recency.
 *
 * Used for the 「同じタグの記事」 block at the bottom of a note.
 */
export function getRelatedNotes(
  locale: Locale,
  currentSlug: string,
  limit: number = 3
): Post[] {
  const all = getAllNotes(locale)
  const current = all.find((n) => n.slug === currentSlug)
  if (!current || !current.tags || current.tags.length === 0) return []

  const scored = all
    .filter((n) => n.slug !== currentSlug)
    .map((note) => {
      const shared = (note.tags ?? []).filter((t) => current.tags?.includes(t)).length
      return { note, shared }
    })
    .filter((x) => x.shared > 0)
    .sort((a, b) => {
      if (b.shared !== a.shared) return b.shared - a.shared
      return (
        new Date(b.note.publishedAt).getTime() - new Date(a.note.publishedAt).getTime()
      )
    })

  return scored.slice(0, limit).map((x) => x.note)
}