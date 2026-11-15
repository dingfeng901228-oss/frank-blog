// src/app/[locale]/404/page.tsx
//
// The 404 page as a REAL route.
//
// WHY THIS FILE EXISTS
// --------------------
// A Next.js static export writes the root out/404.html from the app's
// root not-found route. With the locale segment in the path, that root
// route has no locale layout, so the generated page was Next.js's bare
// English default with no navbar and no footer.
//
// A page at src/app/[locale]/404/page.tsx IS exported to
// out/{locale}/404.html, and because it sits under the locale segment
// it inherits the locale layout: the global stylesheet, the `dark`
// class, the navbar and the footer, and the correct <html lang>.
//
// scripts/build-404-root.mjs (postbuild) then promotes out/ja/404.html
// to the root out/404.html, because that is the file Cloudflare Pages
// serves for any unmatched path. The page itself picks the language
// from the URL after hydration, so /zh/… shows Chinese and /en/… shows
// English.

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import NotFoundPage from '@/components/layout/NotFoundPage'
import type { Locale } from '@/i18n/config'

interface PageProps {
  params: Promise<{ locale: string }>
}

const titles = {
  ja: 'ページが見つかりません',
  zh: '找不到页面',
  en: 'Page not found',
} as const

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return {
    title: titles[locale as keyof typeof titles] ?? titles.ja,
    robots: { index: false, follow: false },
  }
}

export default async function NotFoundRoute({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)
  return <NotFoundPage locale={locale as Locale} />
}
