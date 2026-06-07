'use client'

import { useEffect, useState } from 'react'

interface ArticleSidebarProps {
  locale: string
  publishedAt: string
  readingTime?: string
  tags?: string[]
}

const authorInfo: Record<string, { name: string; title: string; location: string }> = {
  ja: { name: 'Ding Feng', title: 'IT Infrastructure Engineer', location: 'Tokyo, Japan' },
  zh: { name: 'Ding Feng', title: 'IT Infrastructure Engineer', location: 'Tokyo, Japan' },
  en: { name: 'Ding Feng', title: 'IT Infrastructure Engineer', location: 'Tokyo, Japan' },
}

const labels: Record<string, { reading: string; published: string; tags: string; related: string }> = {
  ja: { reading: '読了時間', published: '公開日', tags: 'タグ', related: '関連記事' },
  zh: { reading: '阅读时间', published: '发布日期', tags: '标签', related: '相关文章' },
  en: { reading: 'Reading Time', published: 'Published', tags: 'Tags', related: 'Related' },
}

export default function ArticleSidebar({ locale, publishedAt, readingTime, tags }: ArticleSidebarProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const info = authorInfo[locale] ?? authorInfo.ja
  const t = labels[locale] ?? labels.ja

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(
        locale === 'ja' ? 'ja-JP' : locale === 'zh' ? 'zh-CN' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric' }
      )
    } catch {
      return dateStr
    }
  }

  return (
    <aside className="hidden lg:block sticky" style={{ top: '100px' }}>
      {/* Author card (glass) */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        {/* Avatar placeholder */}
        <div
          className="w-10 h-10 rounded-full mb-3 flex items-center justify-center text-sm font-serif font-medium"
          style={{
            background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
            color: '#fff',
          }}
        >
          F
        </div>

        <div className="text-sm font-medium text-white/90 mb-0.5">{info.name}</div>
        <div className="text-xs text-white/50 mb-0.5">{info.title}</div>
        <div className="text-xs font-mono text-white/40">{info.location}</div>

        {/* Divider */}
        <div className="my-4 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Reading Time */}
        {readingTime && (
          <div className="mb-3">
            <div className="text-[10px] uppercase font-mono tracking-[0.12em] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {t.reading}
            </div>
            <div className="text-xs text-white/70">{readingTime}</div>
          </div>
        )}

        {/* Published Date */}
        <div className="mb-3">
          <div className="text-[10px] uppercase font-mono tracking-[0.12em] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {t.published}
          </div>
          <time className="text-xs text-white/70 font-mono">{formatDate(publishedAt)}</time>
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-mono tracking-[0.12em] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {t.tags}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(59,130,246,0.10)',
                    border: '1px solid rgba(59,130,246,0.15)',
                    color: 'rgba(147,197,253,0.9)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Smooth rendering delay to avoid layout shift */}
      {!mounted && <div className="h-64" />}
    </aside>
  )
}
