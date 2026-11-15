import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { Post, PostFrontmatter } from './types'
import type { Locale } from '@/i18n/config'

const notesDirectory = (locale: Locale) =>
  path.join(process.cwd(), 'src', 'content', locale, 'notes')

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
    readingTime: '',
    ...frontmatter,
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