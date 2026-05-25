'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PostFrontmatter {
  title: string
  description: string
  publishedAt: string
  tags: string[]
  featured: boolean
}

interface Post {
  slug: string
  content: string
  frontmatter: PostFrontmatter
}

interface PostEditorProps {
  mode: 'new' | 'edit'
  initialLocale?: string
  initialSlug?: string
}

const LOCALES = [
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'en', name: 'English' },
]

const AVAILABLE_TAGS = ['Tech', 'AI', 'Life', 'Japan', 'Notes', 'Debug', 'Next.js', 'React', 'Career']

const GITHUB_REPO = 'dingfeng901228-oss/frank-blog'
const CONTENT_BASE = 'src/content'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('gh_token')
}

function setToken(token: string) {
  sessionStorage.setItem('gh_token', token)
}

async function fetchFile(path: string, token: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
  })
  if (!res.ok) return null
  const data = await res.json()
  if (data.encoding === 'base64') {
    return atob(data.content)
  }
  return null
}

async function getSha(path: string, token: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.sha || null
}

async function saveFile(path: string, content: string, token: string, sha?: string | null): Promise<boolean> {
  const body: Record<string, unknown> = {
    message: `Update ${path}`,
    content: btoa(unescape(encodeURIComponent(content))),
  }
  if (sha) body.sha = sha

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

function buildMdx(frontmatter: PostFrontmatter, content: string): string {
  const tags = frontmatter.tags?.length ? `\ntags: [${frontmatter.tags.map(t => `"${t}"`).join(', ')}]` : ''
  return `---
title: "${frontmatter.title.replace(/"/g, '\\"')}"
description: "${frontmatter.description.replace(/"/g, '\\"')}"
publishedAt: "${frontmatter.publishedAt}"${tags}
featured: ${frontmatter.featured}
---

${content}`
}

export default function PostEditor({ mode, initialLocale = 'ja', initialSlug }: PostEditorProps) {
  const router = useRouter()
  const slug = initialSlug

  const [token, setTokenState] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().split('T')[0])
  const [tags, setTags] = useState<string[]>([])
  const [featured, setFeatured] = useState(false)
  const [currentLocale, setCurrentLocale] = useState(initialLocale)
  const [savingLocale, setSavingLocale] = useState<string | null>(null)

  useEffect(() => {
    const t = getToken()
    if (t) {
      setTokenState(t)
      setHasToken(true)
    }
  }, [])

  useEffect(() => {
    if (mode === 'edit' && slug && token) {
      loadPost(slug, initialLocale)
    }
  }, [mode, slug, token, initialLocale])

  async function loadPost(s: string, locale: string) {
    const path = `${CONTENT_BASE}/${locale}/posts/${s}.mdx`
    const fileContent = await fetchFile(path, token)
    if (!fileContent) {
      setMessage({ type: 'error', text: `File not found: ${path}` })
      return
    }
    const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/)
    const contentMatch = fileContent.match(/---\n[\s\S]*?\n---\n([\s\S]*)/)
    if (frontmatterMatch) {
      const fm: Record<string, unknown> = {}
      frontmatterMatch[1].split('\n').forEach(line => {
        const [key, ...rest] = line.split(':')
        if (key && rest.length) {
          let val: unknown = rest.join(':').trim()
          if (val === 'true') val = true
          else if (val === 'false') val = false
          else if (typeof val === 'string' && val.startsWith('[')) {
            val = val.replace(/[\[\]]/g, '').split(',').map(v => v.trim().replace(/"/g, ''))
          }
          fm[key.trim()] = val
        }
      })
      if (fm.title) setTitle(String(fm.title))
      if (fm.description) setDescription(String(fm.description))
      if (fm.publishedAt) setPublishedAt(String(fm.publishedAt))
      if (Array.isArray(fm.tags)) setTags(fm.tags as string[])
      if (fm.featured !== undefined) setFeatured(Boolean(fm.featured))
    }
    if (contentMatch) setContent(contentMatch[1].trim())
  }

  function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (token.trim()) {
      setTokenState(token.trim())
      setToken(token.trim())
      setHasToken(true)
    }
  }

  async function handleSave(s: string | undefined, locale: string) {
    if (!s && !title.trim()) {
      setMessage({ type: 'error', text: 'Title is required' })
      return
    }

    const postSlug = s || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const frontmatter: PostFrontmatter = { title, description, publishedAt, tags, featured }
    const mdx = buildMdx(frontmatter, content)
    const path = `${CONTENT_BASE}/${locale}/posts/${postSlug}.mdx`
    const sha = await getSha(path, token)
    const ok = await saveFile(path, mdx, token, sha)

    if (ok) {
      setSavingLocale(locale)
      setTimeout(() => {
        setSavingLocale(null)
        if (locale === currentLocale) {
          setMessage({ type: 'success', text: `Saved to ${locale}/posts/${postSlug}.mdx` })
        }
      }, 500)
    } else {
      setMessage({ type: 'error', text: `Failed to save ${locale}. Check token permissions.` })
    }
  }

  async function handleSaveAll() {
    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Title is required before saving' })
      return
    }
    const postSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    setSaving(true)
    const results: string[] = []
    for (const { code } of LOCALES) {
      const frontmatter: PostFrontmatter = { title, description, publishedAt, tags, featured }
      const mdx = buildMdx(frontmatter, content)
      const path = `${CONTENT_BASE}/${code}/posts/${postSlug}.mdx`
      const sha = await getSha(path, token)
      const ok = await saveFile(path, mdx, token, sha)
      if (ok) results.push(code)
    }
    setSaving(false)

    if (results.length === LOCALES.length) {
      setMessage({ type: 'success', text: `Saved to all 3 languages (${postSlug})` })
      if (!slug) router.push(`/admin/edit/${postSlug}?locale=${currentLocale}`)
    } else {
      setMessage({ type: 'error', text: `Partial save: ${results.join(', ')} succeeded` })
    }
  }

  if (!hasToken) {
    return (
      <div className="max-w-sm mx-auto py-20">
        <h1 className="font-serif text-2xl font-medium mb-2">{mode === 'new' ? 'New Post' : 'Edit Post'}</h1>
        <p className="text-[var(--muted)] text-sm font-mono mb-8">
          GitHub token required to read/write MDX files.
        </p>
        <form onSubmit={handleTokenSubmit} className="space-y-4">
          <input
            type="password"
            value={token}
            onChange={(e) => setTokenState(e.target.value)}
            placeholder="GitHub Personal Access Token"
            className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <button type="submit" className="w-full py-3 bg-[var(--accent)] text-white text-sm font-mono rounded-lg">
            Continue
          </button>
        </form>
        <p className="text-xs font-mono text-[var(--muted)] mt-4">
          Token needs repo read/write permissions. Stored in sessionStorage only.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground)]">
            ← Posts
          </Link>
          <h1 className="font-serif text-3xl font-medium">{mode === 'new' ? 'New Post' : 'Edit Post'}</h1>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-mono rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save All (ja/zh/en)'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-mono ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {message.text}
        </div>
      )}

      {/* Token indicator */}
      <div className="mb-6 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
        <span className="w-2 h-2 rounded-full bg-green-400"></span>
        GitHub token set
        <button onClick={() => { sessionStorage.removeItem('gh_token'); setHasToken(false); setTokenState('') }} className="ml-4 text-red-400 hover:text-red-300">
          Clear token
        </button>
      </div>

      {/* Locale Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--surface)] p-1 rounded-lg w-fit">
        {LOCALES.map(({ code, name }) => (
          <button
            key={code}
            onClick={() => { setCurrentLocale(code); if (mode === 'edit' && slug) loadPost(slug, code) }}
            className={`px-4 py-2 text-sm font-mono rounded-md transition-colors ${
              currentLocale === code ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-serif text-xl focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description"
            className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">Tags</label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                className={`px-3 py-1.5 text-xs font-mono rounded-full border transition-colors ${
                  tags.includes(tag) ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Featured */}
        <div className="flex gap-6">
          <div>
            <label className="block text-xs font-mono text-[var(--muted)] mb-2 uppercase tracking-wider">Published Date</label>
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
              />
              <span className="text-sm font-mono text-[var(--muted)]">Featured</span>
            </label>
          </div>
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider">Content (MDX)</label>
            <button
              onClick={() => handleSave(slug, currentLocale)}
              disabled={savingLocale === currentLocale}
              className="text-xs font-mono text-[var(--accent)] hover:underline disabled:opacity-50"
            >
              {savingLocale === currentLocale ? 'Saving...' : `Save ${currentLocale} only`}
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post content in MDX format..."
            rows={20}
            className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-sm leading-relaxed focus:outline-none focus:border-[var(--accent)] resize-y"
          />
        </div>

        {/* Help text */}
        <div className="text-xs font-mono text-[var(--muted)] bg-[var(--surface)] rounded-lg p-4 space-y-1">
          <p><strong>Tip:</strong> Use ## for headings, ``` for code blocks, **bold**, *italic*</p>
          <p>MDX files are saved directly to <code>{`src/content/{locale}/posts/`}</code> in the frank-blog repo.</p>
          <p>After saving, push to GitHub to trigger deployment.</p>
        </div>
      </div>
    </div>
  )
}