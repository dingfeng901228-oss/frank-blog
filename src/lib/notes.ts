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
  const { data, content } = matter(fileContents)
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