import type { Locale } from '@/i18n/config'

export interface PostFrontmatter {
  title: string
  description: string
  publishedAt: string
  updatedAt?: string
  tags?: string[]
  coverImage?: string
  locale: Locale
  featured?: boolean
}

export interface Post extends PostFrontmatter {
  slug: string
  content: string
  readingTime: string
}

export interface NavItem {
  label: string
  href: string
}