'use client'

/**
 * SearchBox — the header's search entry point.
 *
 * The index is a static JSON file (out/search-index.json) generated at
 * build time by scripts/build-search-index.mjs. It holds the title,
 * description, tags and URL of every blog post and note, for all three
 * locales, so the search works entirely client-side with no server and
 * no third-party service.
 *
 * The reader types, the box filters the index, and the results appear in
 * a dropdown. Enter opens the full search page with the same query.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/i18n/config'

interface SearchEntry {
  title: string
  description: string
  tags: string[]
  url: string
  kind: 'post' | 'note'
}

interface SearchIndex {
  generatedAt: string
  entries: Record<string, SearchEntry[]>
}

const labels = {
  ja: {
    placeholder: 'サイト内検索…',
    open: '検索',
    results: '検索結果',
    empty: '該当する結果が見つかりませんでした。',
    all: 'すべての記事とノートを検索',
    hint: 'タイトル・概要・タグで検索できます',
    post: '記事',
    note: 'ノート',
  },
  zh: {
    placeholder: '站内搜索…',
    open: '搜索',
    results: '搜索结果',
    empty: '没有找到匹配的结果。',
    all: '搜索所有文章和随笔',
    hint: '可按标题、摘要、标签搜索',
    post: '文章',
    note: '随笔',
  },
  en: {
    placeholder: 'Search…',
    open: 'Search',
    results: 'Results',
    empty: 'No matching results.',
    all: 'Search all posts and notes',
    hint: 'Search by title, summary, or tag',
    post: 'Post',
    note: 'Note',
  },
} as const

export default function SearchBox({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const t = labels[locale] ?? labels.ja

  // Load the index once, lazily, when the reader first opens the box.
  useEffect(() => {
    if (!open || index) return
    let cancelled = false
    fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : { entries: {} }))
      .then((data: SearchIndex) => {
        if (!cancelled) setIndex(data)
      })
      .catch(() => {
        if (!cancelled) setIndex({ generatedAt: '', entries: {} })
      })
    return () => {
      cancelled = true
    }
  }, [open, index])

  // Close on outside click and on Escape.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const results = useMemo(() => {
    if (!index || !query.trim()) return []
    const entries = index.entries[locale] ?? []
    const q = query.trim().toLowerCase()
    return entries
      .filter((e) => {
        if (e.title.toLowerCase().includes(q)) return true
        if ((e.description || '').toLowerCase().includes(q)) return true
        return e.tags.some((t) => t.toLowerCase().includes(q))
      })
      .slice(0, 8)
  }, [index, query, locale])

  function submit() {
    const q = query.trim()
    if (!q) return
    setOpen(false)
    router.push(`/${locale}/search?q=${encodeURIComponent(q)}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) setTimeout(() => inputRef.current?.focus(), 30)
        }}
        aria-label={t.open}
        title={t.open}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono tracking-wider rounded-md transition-all"
        style={{
          color: 'rgba(255, 255, 255, 0.8)',
          background: open ? 'rgba(255,255,255,0.05)' : 'transparent',
        }}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.65" y2="16.65" />
        </svg>
        <span className="hidden lg:inline">{t.open}</span>
      </button>

      {open && (
        <div
          className="dropdown-enter absolute right-0 top-full mt-1.5 w-[min(92vw,380px)] rounded-xl z-50 overflow-hidden"
          style={{
            background: 'rgba(12, 16, 36, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={t.placeholder}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.9)',
              }}
            />
          </div>

          {query.trim() && (
            <div className="max-h-[52vh] overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-4 py-6 text-xs text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {t.empty}
                </p>
              ) : (
                results.map((r, i) => (
                  <a
                    key={r.url}
                    href={r.url}
                    className="block px-4 py-2.5 transition-colors"
                    style={{
                      background: i === active ? 'rgba(255,255,255,0.05)' : 'transparent',
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: r.kind === 'note' ? 'rgba(251,191,36,0.12)' : 'rgba(34,211,238,0.12)',
                          color: r.kind === 'note' ? 'rgba(253,224,71,0.9)' : 'rgba(103,232,249,0.9)',
                        }}
                      >
                        {r.kind === 'note' ? t.note : t.post}
                      </span>
                    </div>
                    <div
                      className="text-sm leading-snug line-clamp-2"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    >
                      {r.title}
                    </div>
                  </a>
                ))
              )}
            </div>
          )}

          <div
            className="px-4 py-2.5 border-t text-[11px]"
            style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
          >
            {query.trim() ? (
              <button type="button" onClick={submit} className="hover:underline" style={{ color: 'inherit' }}>
                {t.all} →
              </button>
            ) : (
              t.hint
            )}
          </div>
        </div>
      )}
    </div>
  )
}
