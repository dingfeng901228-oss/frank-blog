import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['ja', 'zh', 'en'],
  defaultLocale: 'ja',
  localePrefix: 'always',
})

// IMPORTANT: `/admin/:path*` is REMOVED from matcher — admin pages live at
// /admin/* (no locale prefix) per ADR-001 + D-1. next-intl middleware would
// otherwise redirect /admin/login -> /ja/admin/login which breaks admin URLs.
export const config = {
  matcher: ['/', '/(ja|zh|en)/:path*'],
}