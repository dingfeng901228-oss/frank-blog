import type { Metadata } from 'next'
import '../globals.css'
import { locales } from '@/i18n/config'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

const siteName = 'Frank Ding'
const defaultDescription: Record<string, string> = {
  ja: '技術は手段であり、思考こそが本質。学び続け、考え続け、技術を通して世界を探求する。',
  zh: '技术是工具，思考才是核心。持续学习，记录思考，用技术探索世界。',
  en: 'Technology is a tool. Thinking is the core. Keep learning, keep exploring, and understand the world through technology.',
}

const defaultTitles: Record<string, string> = {
  ja: 'Frank Ding — 世界に対して、いつも好奇心を持ち続ける人',
  zh: 'Frank Ding — 对世界始终保持好奇的人',
  en: 'Frank Ding — A Person Who Always Stays Curious About the World',
}

const ogLocale: Record<string, string> = {
  ja: 'ja_JP',
  zh: 'zh_CN',
  en: 'en_US',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return {
    title: {
      default: defaultTitles[locale] ?? defaultTitles.ja,
      template: `%s — ${siteName}`,
    },
    description: defaultDescription[locale] ?? defaultDescription.ja,
    metadataBase: new URL('https://blog.frank2025.com'),
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}`,
      languages: {
        'ja': 'https://blog.frank2025.com/ja',
        'zh': 'https://blog.frank2025.com/zh',
        'en': 'https://blog.frank2025.com/en',
        'x-default': 'https://blog.frank2025.com/ja',
      },
    },
    openGraph: {
      type: 'website',
      siteName,
      locale: ogLocale[locale] ?? 'ja_JP',
      alternateLocale: ['ja_JP', 'zh_CN', 'en_US'],
      title: defaultTitles[locale] ?? defaultTitles.ja,
      description: defaultDescription[locale] ?? defaultDescription.ja,
      url: `https://blog.frank2025.com/${locale}`,
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Frank Ding',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitles[locale] ?? defaultTitles.ja,
      description: defaultDescription[locale] ?? defaultDescription.ja,
      images: ['/og-image.jpg'],
    },
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/favicon.jpg', type: 'image/jpeg' },
        { url: '/feng_favicon.svg', type: 'image/svg+xml' },
      ],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      // Add Google Search Console verification code here if you have one
      // google: 'YOUR_VERIFICATION_CODE',
    },
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Ding Feng',
    alternateName: 'Frank Ding',
    url: 'https://blog.frank2025.com',
    jobTitle: 'IT Infrastructure Engineer',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Tokyo',
      addressCountry: 'JP',
    },
    knowsAbout: ['TypeScript', 'Python', 'AI', 'Linux', 'Docker', 'Cloud'],
    sameAs: [
      'https://github.com/dingfeng901228-oss',
    ],
  }

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Frank Ding',
    url: 'https://blog.frank2025.com',
    description:
      locale === 'ja'
        ? '学び続け、考え続け、技術を通して世界を探求する'
        : locale === 'zh'
          ? '持续学习，记录思考，用技术探索世界'
          : 'Keep learning, keep exploring, and understand the world through technology.',
  }

  return (
    <html lang={locale} className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
