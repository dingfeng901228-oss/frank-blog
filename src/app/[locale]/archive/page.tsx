import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import { getAllEntries, groupByMonth, groupByYear } from '@/lib/archive'
import { formatDate } from '@/lib/utils'

interface PageProps {
  params: Promise<{ locale: string }>
}

const copy = {
  ja: {
    title: 'アーカイブ',
    description: '年・月ごとの記事とノートのアーカイブです。',
    byYear: '年別',
    byMonth: '月別',
    all: 'すべての記事',
    empty: 'この期間の記事はありません。',
    count: (n: number) => `${n} 件`,
    post: '記事',
    note: 'ノート',
  },
  zh: {
    title: '归档',
    description: '按年和月归档的文章与随笔。',
    byYear: '按年',
    byMonth: '按月',
    all: '全部文章',
    empty: '这个时间段没有文章。',
    count: (n: number) => `${n} 篇`,
    post: '文章',
    note: '随笔',
  },
  en: {
    title: 'Archive',
    description: 'All blog posts and notes, by year and by month.',
    byYear: 'By year',
    byMonth: 'By month',
    all: 'All entries',
    empty: 'Nothing published in this period.',
    count: (n: number) => `${n}`,
    post: 'Post',
    note: 'Note',
  },
} as const

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = copy[locale as keyof typeof copy] ?? copy.ja
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/archive`,
    },
  }
}

export default async function ArchivePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = copy[locale as keyof typeof copy] ?? copy.ja
  const entries = getAllEntries(locale as Locale)
  const years = groupByYear(entries)
  const months = groupByMonth(entries)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.title}</h1>
          <p className="text-[var(--muted)]">{t.description}</p>
        </section>

        {/* Year index */}
        <section className="py-12 border-b border-[var(--border)]">
          <h2 className="text-xs font-mono text-[var(--muted)] tracking-widest mb-6">
            {t.byYear}
          </h2>
          <div className="flex flex-wrap gap-3">
            {years.map((y) => (
              <Link
                key={y.key}
                href={`/${locale}/archive/${y.key}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-colors"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  textDecoration: 'none',
                }}
              >
                {y.year}
                <span className="text-xs opacity-60">{t.count(y.entries.length)}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Month index */}
        <section className="py-12">
          <h2 className="text-xs font-mono text-[var(--muted)] tracking-widest mb-6">
            {t.byMonth}
          </h2>
          <div className="flex flex-wrap gap-3">
            {months.map((m) => (
              <Link
                key={m.key}
                href={`/${locale}/archive/${m.key}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono transition-colors"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  textDecoration: 'none',
                }}
              >
                {m.year} {m.month}
                <span className="text-xs opacity-60">{t.count(m.entries.length)}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}
