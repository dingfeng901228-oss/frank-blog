import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import { getAllEntries, groupByMonth, groupByYear } from '@/lib/archive'
import { formatDate, formatMonth, monthKey } from '@/lib/utils'
import { tagHref } from '@/lib/tags'

interface PageProps {
  params: Promise<{ locale: string; period: string }>
}

const copy = {
  ja: {
    title: 'アーカイブ',
    empty: 'この期間の記事はありません。',
    count: (n: number) => `${n} 件`,
    post: '記事',
    note: 'ノート',
    back: 'アーカイブ一覧へ戻る',
  },
  zh: {
    title: '归档',
    empty: '这个时间段没有文章。',
    count: (n: number) => `${n} 篇`,
    post: '文章',
    note: '随笔',
    back: '返回归档列表',
  },
  en: {
    title: 'Archive',
    empty: 'Nothing published in this period.',
    count: (n: number) => `${n}`,
    post: 'Post',
    note: 'Note',
    back: 'Back to archive',
  },
} as const

/**
 * The period is either a year ("2026") or a month ("2026-09"). Both are
 * enumerated here so the static export can produce a page for each.
 */
export async function generateStaticParams() {
  const { getAllLocales } = await import('@/lib/blog')
  const locales = getAllLocales() as unknown as string[]
  const params: { locale: string; period: string }[] = []
  for (const locale of locales) {
    const entries = getAllEntries(locale as Locale)
    for (const y of groupByYear(entries)) params.push({ locale, period: y.key })
    for (const m of groupByMonth(entries)) params.push({ locale, period: m.key })
  }
  return params
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, period } = await params
  const entries = getAllEntries(locale as Locale)
  const all = [...groupByYear(entries), ...groupByMonth(entries)]
  const group = all.find((g) => g.key === period)
  if (!group) return { title: copy[locale as keyof typeof copy]?.title ?? 'Archive' }
  const label = group.month ? `${group.year} ${group.month}` : group.year
  return {
    title: `${label} — ${copy[locale as keyof typeof copy]?.title ?? 'Archive'}`,
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/archive/${period}`,
    },
  }
}

export default async function ArchivePeriodPage({ params }: PageProps) {
  const { locale, period } = await params
  setRequestLocale(locale as Locale)

  const t = copy[locale as keyof typeof copy] ?? copy.ja
  const entries = getAllEntries(locale as Locale)
  const years = groupByYear(entries)
  const months = groupByMonth(entries)
  const group = [...years, ...months].find((g) => g.key === period)
  if (!group) notFound()

  const label = group.month ? `${group.year} ${group.month}` : group.year

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        <div className="mb-8 lg:mb-12">
          <Link
            href={`/${locale}/archive`}
            className="text-xs font-mono transition-colors hover:text-[var(--accent)]"
            style={{ color: 'var(--muted)' }}
          >
            ← {t.back}
          </Link>
        </div>

        <section className="py-12 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-3">{label}</h1>
          <p className="text-[var(--muted)] font-mono text-sm">{t.count(group.entries.length)}</p>
        </section>

        <section className="py-10">
          {group.entries.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-20">{t.empty}</p>
          ) : (
            <div className="space-y-0">
              {group.entries.map((e) => (
                <article
                  key={`${e.kind}-${e.slug}`}
                  className="group grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 md:gap-10 py-8 border-b border-[var(--border)] last:border-b-0"
                >
                  <div className="flex flex-col gap-1">
                    <time
                      dateTime={e.publishedAt}
                      className="text-xs font-mono whitespace-nowrap"
                      style={{ color: 'var(--muted)' }}
                    >
                      {formatDate(e.publishedAt, locale)}
                    </time>
                    <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                      {e.readingTime}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/${locale}/${e.kind === 'note' ? 'notes' : 'blog'}/${e.slug}`}
                    >
                      <h2 className="font-serif text-xl md:text-2xl font-medium mb-2 leading-snug group-hover:text-[var(--accent)] transition-colors">
                        {e.title}
                      </h2>
                    </Link>
                    {e.description && (
                      <p className="text-[var(--muted)] leading-relaxed text-[15px]">
                        {e.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <span
                        className={`text-xs font-mono border border-current/20 rounded-full px-2 py-0.5 ${
                          e.kind === 'note' ? 'text-amber-400/80' : 'text-cyan-400/80'
                        }`}
                      >
                        {e.kind === 'note' ? t.note : t.post}
                      </span>
                      {e.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={tagHref(locale, e.kind === 'note' ? 'notes' : 'blog', tag)}
                          className="text-xs font-mono px-2 py-0.5 bg-[var(--card)] rounded transition-colors hover:text-[var(--accent)]"
                          style={{ color: 'var(--muted)' }}
                        >
                          {tag}
                        </Link>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}
