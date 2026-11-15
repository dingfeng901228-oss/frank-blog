// src/app/[locale]/not-found.tsx
//
// What `notFound()` falls back to inside the locale segment. It renders
// the same component as the /{locale}/404 page, so a visitor who hits
// a missing article sees the in-site 404 — navbar, footer, and the
// 「ホームへ戻る」 link — rather than Next.js's bare English page.
//
// The static export writes this to out/{locale}/404.html only when the
// route below exists; the [locale]/404/page.tsx route is what
// guarantees the file is produced.

import NotFoundPage from '@/components/layout/NotFoundPage'
import type { Locale } from '@/i18n/config'

export default function NotFound({
  params,
}: {
  params?: Promise<{ locale: string }>
}) {
  // The locale is resolved on the client by the component itself, so
  // there is nothing to await here.
  void params
  return <NotFoundPage locale={'ja' as Locale} />
}
