import { getAllPosts } from '@/lib/blog'
import { getAllNotes } from '@/lib/notes'
import { monthKey, formatMonth, formatYear } from '@/lib/utils'
import type { Locale } from '@/i18n/config'
import type { Post } from '@/lib/types'

export interface ArchiveEntry {
  slug: string
  title: string
  description: string
  publishedAt: string
  readingTime: string
  tags: string[]
  kind: 'post' | 'note'
}

export interface ArchiveGroup {
  key: string
  year: string
  month: string
  entries: ArchiveEntry[]
}

/**
 * Every blog post and note for a locale, as one merged, date-sorted list.
 * The archive pages, the tag index and the search all work off this.
 */
export function getAllEntries(locale: Locale): ArchiveEntry[] {
  const posts = getAllPosts(locale).map(
    (p): ArchiveEntry => ({
      slug: p.slug,
      title: p.title,
      description: p.description ?? '',
      publishedAt: p.publishedAt,
      readingTime: p.readingTime,
      tags: p.tags ?? [],
      kind: 'post',
    })
  )
  const notes = getAllNotes(locale).map(
    (n): ArchiveEntry => ({
      slug: n.slug,
      title: n.title,
      description: n.description ?? '',
      publishedAt: n.publishedAt,
      readingTime: n.readingTime,
      tags: n.tags ?? [],
      kind: 'note',
    })
  )
  return [...posts, ...notes].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

/**
 * Group the entries by month, newest month first.
 */
export function groupByMonth(entries: ArchiveEntry[]): ArchiveGroup[] {
  const byKey = new Map<string, ArchiveEntry[]>()
  for (const e of entries) {
    const key = monthKey(e.publishedAt)
    if (!key) continue
    const list = byKey.get(key)
    if (list) list.push(e)
    else byKey.set(key, [e])
  }
  return Array.from(byKey.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({
      key,
      year: formatYear(list[0].publishedAt),
      month: formatMonth(list[0].publishedAt),
      entries: list,
    }))
}

/**
 * Group the entries by year, newest year first.
 */
export function groupByYear(entries: ArchiveEntry[]): ArchiveGroup[] {
  const byKey = new Map<string, ArchiveEntry[]>()
  for (const e of entries) {
    const key = formatYear(e.publishedAt)
    if (!key) continue
    const list = byKey.get(key)
    if (list) list.push(e)
    else byKey.set(key, [e])
  }
  return Array.from(byKey.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0])).map(([key, list]) => ({
      key,
      year: key,
      month: '',
      entries: list,
    }))
}

/**
 * Every tag used in the locale, with the number of entries carrying it.
 * Tags are counted across BOTH blog posts and notes.
 */
export function getTagCounts(locale: Locale): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>()
  for (const e of getAllEntries(locale)) {
    for (const tag of e.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag)))
}
