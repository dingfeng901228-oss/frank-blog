'use client'

import { useEffect, useRef } from 'react'

interface GiscusProps {
  mapping?: string
  term?: string
}

export default function Giscus({
  mapping = 'specific',
  term = 'blog',
}: GiscusProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const lang = window.location.pathname.startsWith('/zh') ? 'zh-CN'
      : window.location.pathname.startsWith('/en') ? 'en'
      : 'ja'

    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.setAttribute('data-repo', 'dingfeng901228-oss/frank-blog')
    script.setAttribute('data-repo-id', 'R_kgDOSmxyRQ')
    script.setAttribute('data-category', 'General')
    script.setAttribute('data-category-id', 'DIC_kwDOSmxyRc4C9w30')
    script.setAttribute('data-mapping', mapping)
    script.setAttribute('data-term', term)
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'top')
    script.setAttribute('data-theme', 'dark')
    script.setAttribute('data-lang', lang)
    script.setAttribute('data-loading', 'lazy')
    script.crossOrigin = 'anonymous'
    script.async = true

    ref.current.appendChild(script)

    return () => {
      if (ref.current) {
        ref.current.innerHTML = ''
      }
    }
  }, [mapping, term])

  return <div ref={ref} className="giscus" />
}