import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import { getAllEntries } from '@/lib/archive'
import { copy } from './copy'
import SearchApp from './SearchApp'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = copy[locale as keyof typeof copy] ?? copy.ja
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/search`,
    },
  }
}

export default async function SearchPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  // The entries are read at build time and handed to the client component,
  // which does the filtering from the query string in the browser. The page
  // itself is a static file — `output: 'export'` cannot prerender a server
  // component that awaits `searchParams`.
  const entries = getAllEntries(locale as Locale)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        <SearchApp locale={locale} entries={entries} />
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}
