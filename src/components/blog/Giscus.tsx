'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'

interface GiscusProps {
  mapping?: string
  term?: string
}

export default function Giscus({
  mapping = 'specific',
  term = 'blog',
}: GiscusProps) {
  const locale = useLocale()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.setAttribute('data-repo', 'dingfeng901228-oss/frank-blog-new')
    script.setAttribute('data-repo-id', 'R_kgDOOAuthentication')
    script.setAttribute('data-category', 'Announcements')
    script.setAttribute('data-category-id', 'DIC_kwDOOAuthentication4C')
    script.setAttribute('data-mapping', mapping)
    script.setAttribute('data-term', term)
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'top')
    script.setAttribute('data-theme', 'dark')
    script.setAttribute('data-lang', locale === 'ja' ? 'ja' : locale === 'zh' ? 'zh-CN' : 'en')
    script.setAttribute('data-loading', 'lazy')
    script.crossOrigin = 'anonymous'
    script.async = true

    ref.current.appendChild(script)

    return () => {
      if (ref.current) {
        ref.current.innerHTML = ''
      }
    }
  }, [locale, mapping, term])

  return <div ref={ref} className="giscus" />
}