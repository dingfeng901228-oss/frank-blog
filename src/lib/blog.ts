import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { Post, PostFrontmatter } from './types'
import type { Locale } from '@/i18n/config'
import { readingTimeFor } from './reading-time'
import { normalizeTags } from './tags'

const postsDirectory = (locale: Locale) =>
  path.join(process.cwd(), 'src', 'content', locale, 'posts')

/**
 * Every tag the site knows about, across all locales.
 *
 * The tag normalizer uses it to tell a genuinely-concatenated tag
 * ("AIエージェント.AI Agent") from a legitimate dotted name
 * ("Node.js") — see src/lib/tags.ts for the rule.
 *
 * Cached: it reads every frontmatter in the content tree, and it is
 * needed by every post.
 */
let knownTagsCache: Set<string> | null = null

function knownTags(): Set<string> {
  if (knownTagsCache) return knownTagsCache

  const set = new Set<string>()
  for (const locale of ['ja', 'zh', 'en'] as Locale[]) {
    const dir = postsDirectory(locale)
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

export function getPostSlugs(locale: Locale): string[] {
  const dir = postsDirectory(locale)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map((f) => f.replace(/\.(mdx|md)$/, ''))
}

export function getPostBySlug(locale: Locale, slug: string): Post | null {
  const fullPath = path.join(postsDirectory(locale), `${slug}.mdx`)
  const fullPathMd = path.join(postsDirectory(locale), `${slug}.md`)

  let filePath = fullPath
  if (!fs.existsSync(fullPath) && fs.existsSync(fullPathMd)) {
    filePath = fullPathMd
  }
  if (!fs.existsSync(filePath)) return null

  const fileContents = fs.readFileSync(filePath, 'utf8')
  // Force `language: 'yaml'` to bypass gray-matter's first-line language detection
  // (under Next 15 webpack bundling it can otherwise capture the YAML's first
  // data line as a phantom engine name and throw "engine ... is not registered").
  const { data, content } = matter(fileContents, { language: 'yaml' })
  const frontmatter = data as PostFrontmatter

  return {
    slug,
    content,
    // The reading time is computed from the content, in the reader's
    // language, so every surface that shows it shows the SAME value.
    readingTime: readingTimeFor(content, locale),
    ...frontmatter,
    // Tags are normalized, so a tag that was accidentally pasted together
    // still yields a working tag page.
    tags: normalizeTags(frontmatter.tags, knownTags()),
  }
}

export function getAllPosts(locale: Locale): Post[] {
  const slugs = getPostSlugs(locale)
  const posts = slugs
    .map((slug) => getPostBySlug(locale, slug))
    .filter((p): p is Post => p !== null)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  return posts
}

export function getFeaturedPosts(locale: Locale, limit = 3): Post[] {
  return getAllPosts(locale)
    .filter((p) => p.featured)
    .slice(0, limit)
}

export function getAllTags(locale: Locale): string[] {
  const posts = getAllPosts(locale)
  const tagSet = new Set<string>()
  posts.forEach((post) => {
    post.tags?.forEach((tag) => tagSet.add(tag))
  })
  return Array.from(tagSet).sort()
}

export function getPostsByTag(locale: Locale, tag: string): Post[] {
  return getAllPosts(locale).filter((p) => p.tags?.includes(tag))
}

export function getAllLocales(): Locale[] {
  return ['ja', 'zh', 'en']
}

/**
 * Find up to `limit` other posts that share at least one tag with the
 * given post, ranked by how many tags they share and then by recency.
 *
 * Used for the 「同じタグの記事」 block at the bottom of an article.
 */
export function getRelatedPosts(
  locale: Locale,
  currentSlug: string,
  limit: number = 3
): Post[] {
  const all = getAllPosts(locale)
  const current = all.find((p) => p.slug === currentSlug)
  if (!current || !current.tags || current.tags.length === 0) return []

  const scored = all
    .filter((p) => p.slug !== currentSlug)
    .map((post) => {
      const shared = (post.tags ?? []).filter((t) => current.tags?.includes(t)).length
      return { post, shared }
    })
    .filter((x) => x.shared > 0)
    .sort((a, b) => {
      if (b.shared !== a.shared) return b.shared - a.shared
      return (
        new Date(b.post.publishedAt).getTime() - new Date(a.post.publishedAt).getTime()
      )
    })

  return scored.slice(0, limit).map((x) => x.post)
}