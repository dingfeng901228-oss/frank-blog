'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Post {
  slug: string
  title: string
  description: string
  publishedAt: string
  tags: string[]
  locale: string
}

interface PostListProps {
  initialPosts: Post[]
}

const localeNames: Record<string, string> = {
  ja: '日本語',
  zh: '中文',
  en: 'English',
}

export default function PostList({ initialPosts }: PostListProps) {
  const [posts] = useState<Post[]>(initialPosts)
  const [search, setSearch] = useState('')

  const filtered = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-3xl font-medium">Posts</h1>
        <Link
          href="/admin/new"
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-mono rounded-lg hover:opacity-90 transition-opacity"
        >
          + New Post
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* Posts Table */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
              <th className="text-left px-4 py-3 font-mono text-[var(--muted)] text-xs uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-3 font-mono text-[var(--muted)] text-xs uppercase tracking-wider hidden md:table-cell">Tags</th>
              <th className="text-left px-4 py-3 font-mono text-[var(--muted)] text-xs uppercase tracking-wider hidden sm:table-cell">Locale</th>
              <th className="text-left px-4 py-3 font-mono text-[var(--muted)] text-xs uppercase tracking-wider">Date</th>
              <th className="text-right px-4 py-3 font-mono text-[var(--muted)] text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[var(--muted)] font-mono">
                  No posts found
                </td>
              </tr>
            ) : (
              filtered.map((post) => (
                <tr key={`${post.locale}-${post.slug}`} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)]/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-medium">{post.title}</div>
                    <div className="text-[var(--muted)] text-xs mt-1 line-clamp-1">{post.description}</div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {post.tags?.map((tag) => (
                        <span key={tag} className="text-xs font-mono text-[var(--accent)]">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="font-mono text-xs text-[var(--muted)]">{localeNames[post.locale] || post.locale}</span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-[var(--muted)] whitespace-nowrap">
                    {post.publishedAt}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/edit?slug=${post.slug}&locale=${post.locale}`}
                        className="text-xs font-mono text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/${post.locale}/blog/${post.slug}`}
                        target="_blank"
                        className="text-xs font-mono text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs font-mono text-[var(--muted)] mt-4">
        {filtered.length} of {posts.length} posts
      </p>
    </div>
  )
}