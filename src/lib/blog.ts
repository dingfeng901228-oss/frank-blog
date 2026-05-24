import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'
import type { Post, PostFrontmatter } from './types'
import type { Locale } from '@/i18n/config'

const postsDirectory = (locale: Locale) =>
  path.join(process.cwd(), 'src', 'content', locale, 'posts')

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
  const { data, content } = matter(fileContents)
  const frontmatter = data as PostFrontmatter
  const rt = readingTime(content)

  return {
    slug,
    content,
    readingTime: rt.text,
    ...frontmatter,
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