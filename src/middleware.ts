import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['ja', 'zh', 'en'],
  defaultLocale: 'ja',
  localePrefix: 'always',
})

export const config = {
  matcher: ['/', '/(ja|zh|en)/:path*', '/admin/:path*'],
}