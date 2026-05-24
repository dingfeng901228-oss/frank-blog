import type { Metadata } from 'next'
import './globals.css'
import { locales } from '@/i18n/config'
import { getMessages } from 'next-intl/server'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  title: {
    default: 'Notes — Frank Ding',
    template: '%s — Frank Ding',
  },
  description: 'Thoughts, code, and quiet observations.',
  metadataBase: new URL('https://blog.frank2025.com'),
  openGraph: {
    type: 'website',
    siteName: 'Frank Ding',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}