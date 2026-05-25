'use client'

import { useState } from 'react'
import Link from 'next/link'

const GITHUB_REPO = 'dingfeng901228-oss/frank-blog'

interface Post {
  slug: string
  title: string
  description: string
  publishedAt: string
  tags: string[]
  locale: string
}

function getToken(): string | null {
  return sessionStorage.getItem('gh_token')
}

export default function AdminPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [token] = useState(() => getToken())

  async function loadPosts() {
    if (!token) return
    setLoading(true)
    try {
      const locales = ['ja', 'zh', 'en']
      const allPosts: Post[] = []
      for (const locale of locales) {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/src/content/${locale}/posts`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
        )
        if (!res.ok) continue
        const files = await res.json()
        for (const file of files || []) {
          if (!file.name.endsWith('.mdx') && !file.name.endsWith('.md')) continue
          const slug = file.name.replace(/\.(mdx|md)$/, '')
          const contentRes = await fetch(file.url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } })
          if (!contentRes.ok) continue
          const contentData = await contentRes.json()
          const content = atob(contentData.content)
          const titleMatch = content.match(/^title:\s*"?([^"\n]+)"?/m)
          const descMatch = content.match(/^description:\s*"?([^"\n]+)"?/m)
          const dateMatch = content.match(/^publishedAt:\s*"?([^"\n]+)"?/m)
          const tagsMatch = content.match(/^tags:\s*\[([^\]]+)\]/m)
          allPosts.push({
            slug,
            title: titleMatch ? titleMatch[1].trim() : slug,
            description: descMatch ? descMatch[1].trim() : '',
            publishedAt: dateMatch ? dateMatch[1].trim() : '',
            tags: tagsMatch ? tagsMatch[1].split(',').map((t: string) => t.trim().replace(/"/g, '')) : [],
            locale,
          })
        }
      }
      allPosts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      setPosts(allPosts)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto py-20 text-center">
        <h1 className="font-serif text-3xl font-medium mb-4">Admin</h1>
        <p className="text-[var(--muted)] text-sm font-mono mb-8">
          Please login at{' '}
          <Link href="/admin/login" className="text-[var(--accent)] hover:underline">/admin/login</Link>
          {' '}first.
        </p>
      </div>
    )
  }

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
        <div className="flex items-center gap-3">
          <button
            onClick={loadPosts}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-mono text-[var(--muted)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/30 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Reload from GitHub'}
          </button>
          <Link
            href="/admin/new"
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-mono rounded-lg hover:opacity-90 transition-opacity"
          >
            + New Post
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={posts.length === 0 ? loadPosts : undefined}
          className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* Hint */}
      {posts.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="text-[var(--muted)] text-sm font-mono mb-4">No posts loaded yet.</p>
          <button
            onClick={loadPosts}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-mono rounded-lg hover:opacity-90"
          >
            Load Posts from GitHub
          </button>
        </div>
      )}

      {/* Posts Table */}
      {posts.length > 0 && (
        <>
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
                {filtered.map((post) => (
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
                      <span className="font-mono text-xs text-[var(--muted)]">{post.locale}</span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-[var(--muted)] whitespace-nowrap">
                      {post.publishedAt}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/edit/${post.slug}?locale=${post.locale}`}
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
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs font-mono text-[var(--muted)] mt-4">
            {filtered.length} of {posts.length} posts
          </p>
        </>
      )}
    </div>
  )
}