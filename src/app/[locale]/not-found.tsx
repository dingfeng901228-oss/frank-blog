'use client'

// src/app/[locale]/not-found.tsx
//
// The in-site 404 page. It is a locale route so it inherits the site's
// real layout (Navbar, Footer, the global stylesheet, the `dark` class and
// the correct <html lang>) instead of Next.js's bare English default.
//
// Cloudflare Pages serves the ROOT /404.html for any unmatched path, so
// scripts/build-404-root.mjs (postbuild) promotes this page to out/404.html
// and injects a tiny locale sniffer — a visitor who mistypes
// /zh/some-page gets the Chinese 404, not the Japanese one.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import type { Locale } from '@/i18n/config'

const copy = {
  ja: {
    code: '404',
    title: 'ページが見つかりません',
    description: 'お探しのページは、移動したか、削除された可能性があります。',
    back: 'ホームへ戻る',
    suggestions: 'こちらからも探せます',
    blog: 'ブログ',
    notes: 'ノート',
    about: '概要',
  },
  zh: {
    code: '404',
    title: '找不到页面',
    description: '您访问的页面可能已被移动或删除。',
    back: '返回首页',
    suggestions: '也可以从这里查找',
    blog: '博客',
    notes: '随笔',
    about: '关于',
  },
  en: {
    code: '404',
    title: 'Page not found',
    description: 'The page you are looking for may have been moved or removed.',
    back: 'Back to home',
    suggestions: 'You can also look from here',
    blog: 'Blog',
    notes: 'Notes',
    about: 'About',
  },
} as const

export default function NotFound() {
  // The static build renders the Japanese page for every locale (the build
  // has no request context). On the client we correct it from the URL, so
  // /zh/… shows Chinese and /en/… shows English.
  const [locale, setLocale] = useState<Locale>('ja')

  useEffect(() => {
    const m = /^\/(zh|en)(?:\/|$)/.exec(window.location.pathname)
    if (m) setLocale(m[1] as Locale)
  }, [])

  const t = copy[locale]

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar locale={locale} />

      <main className="flex-1 mx-auto w-full max-w-[1480px] px-6 lg:px-16 xl:px-20 py-20 lg:py-28 flex items-center">
        <div className="w-full max-w-2xl">
          <div
            className="font-mono text-6xl lg:text-7xl font-medium leading-none mb-6"
            style={{ color: 'var(--accent)' }}
          >
            {t.code}
          </div>
          <h1
            className="font-serif text-3xl md:text-4xl lg:text-5xl font-medium leading-tight mb-5"
            style={{ color: 'var(--foreground-strong)' }}
          >
            {t.title}
          </h1>
          <p
            className="text-base lg:text-lg leading-relaxed mb-10"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            {t.description}
          </p>

          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              color: 'rgba(147,197,253,0.95)',
              textDecoration: 'none',
            }}
          >
            ← {t.back}
          </Link>

          <div className="mt-14">
            <div
              className="text-[10px] uppercase font-mono tracking-[0.15em] mb-4"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {t.suggestions}
            </div>
            <div className="flex flex-wrap gap-3">
              {([
                ['blog', `/${locale}/blog`],
                ['notes', `/${locale}/notes`],
                ['about', `/${locale}/about`],
              ] as const).map(([key, href]) => (
                <Link
                  key={key}
                  href={href}
                  className="px-4 py-2.5 rounded-lg text-sm transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.75)',
                    textDecoration: 'none',
                  }}
                >
                  {t[key]}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  )
}
