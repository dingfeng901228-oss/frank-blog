'use client'

import { useEffect, useState, useRef } from 'react'

interface TocItem {
  id: string
  text: string
  level: number
}

/** Extract heading ids + text from the rendered article. */
function buildToc(container: HTMLElement): TocItem[] {
  const items: TocItem[] = []
  const headings = container.querySelectorAll('h2, h3')
  headings.forEach((h) => {
    const id = h.id || h.textContent?.toLowerCase().replace(/\s+/g, '-') || ''
    if (!h.id) h.id = id // set id if rehypeSlug didn't give one
    items.push({ id, text: h.textContent || '', level: h.tagName === 'H2' ? 2 : 3 })
  })
  return items
}

export default function ArticleTOC() {
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState('')
  const [open, setOpen] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // Find the article container
    const article = document.querySelector('article.reading-content') as HTMLElement | null
    if (!article) return

    const toc = buildToc(article)
    setItems(toc)

    if (toc.length === 0) return

    // IntersectionObserver for scroll-spy
    const ids = toc.map((t) => t.id)
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  if (items.length === 0) return null

  return (
    <>
      {/* Mobile: collapsible button */}
      <button
        className="lg:hidden flex items-center gap-2 w-full px-4 py-3 rounded-lg text-xs font-mono tracking-wider transition-colors"
        style={{
          background: open ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.8)',
        }}
        onClick={() => setOpen(!open)}
      >
        <svg className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Table of Contents
      </button>

      {open && (
        <nav className="lg:hidden mb-8 p-4 rounded-xl" style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => { e.preventDefault(); setOpen(false); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }) }}
              className="block py-1.5 text-xs transition-colors"
              style={{
                paddingLeft: item.level === 3 ? '1.25rem' : '0',
                color: activeId === item.id ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.55)',
              }}
            >
              {item.text}
            </a>
          ))}
        </nav>
      )}

      {/* Desktop: sticky sidebar */}
      <nav className="hidden lg:block sticky" style={{ top: '100px' }}>
        <div className="text-[10px] uppercase font-mono tracking-[0.15em] mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          On this page
        </div>
        <div className="relative">
          {/* Active line indicator */}
          <div className="absolute left-0 top-0 w-px h-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {activeId && (
              <div
                className="w-px transition-all duration-300"
                style={{
                  background: '#3B82F6',
                  height: '20px',
                  transform: `translateY(${items.findIndex(i => i.id === activeId) * 28}px)`,
                  boxShadow: '0 0 8px rgba(59,130,246,0.5)',
                }}
              />
            )}
          </div>
          <div className="pl-4 flex flex-col gap-1">
            {items.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="block py-1 text-xs leading-relaxed transition-all duration-200"
                style={{
                  paddingLeft: item.level === 3 ? '0.75rem' : '0',
                  fontWeight: activeId === item.id ? 500 : 400,
                  color: activeId === item.id ? '#ffffff' : 'rgba(255,255,255,0.45)',
                  borderLeft: activeId === item.id ? '1px solid #3B82F6' : '1px solid transparent',
                  marginLeft: '-1px',
                }}
              >
                {item.text}
              </a>
            ))}
          </div>
        </div>
      </nav>
    </>
  )
}
