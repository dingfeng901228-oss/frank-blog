import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import { getAllEntries } from '@/lib/archive'
import { formatDate } from '@/lib/utils'
import { tagHref } from '@/lib/tags'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; tag?: string }>
}

const copy = {
  ja: {
    title: 'サイト内検索',
    description: '記事とノートをタイトル・概要・タグから検索できます。',
    placeholder: '検索キーワードを入力…',
    search: '検索',
    resultsFor: (q: string) => `「${q}」の検索結果`,
    resultsForTag: (tag: string) => `タグ「${tag}」の記事`,
    count: (n: number) => `${n} 件`,
    empty: '該当する記事が見つかりませんでした。',
    all: 'すべての記事とノート',
    post: '記事',
    note: 'ノート',
  },
  zh: {
    title: '站内搜索',
    description: '按标题、摘要、标签搜索文章和随笔。',
    placeholder: '输入搜索关键词…',
    search: '搜索',
    resultsFor: (q: string) => `“${q}” 的搜索结果`,
    resultsForTag: (tag: string) => `标签 “${tag}” 的文章`,
    count: (n: number) => `${n} 篇`,
    empty: '没有找到匹配的文章。',
    all: '所有文章和随笔',
    post: '文章',
    note: '随笔',
  },
  en: {
    title: 'Search',
    description: 'Search posts and notes by title, summary, or tag.',
    placeholder: 'Type to search…',
    search: 'Search',
    resultsFor: (q: string) => `Results for “${q}”`,
    resultsForTag: (tag: string) => `Posts tagged “${tag}”`,
    count: (n: number) => `${n}`,
    empty: 'Nothing matched your search.',
    all: 'All posts and notes',
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
      canonical: `https://blog.frank2025.com/${locale}/search`,
    },
  }
}

export default async function SearchPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { q, tag } = await searchParams
  setRequestLocale(locale as Locale)

  const t = copy[locale as keyof typeof copy] ?? copy.ja
  const entries = getAllEntries(locale as Locale)

  const query = (q ?? '').trim()
  const tagFilter = (tag ?? '').trim()

  let results = entries
  if (tagFilter) {
    results = results.filter((e) => e.tags.includes(tagFilter))
  } else if (query) {
    const needle = query.toLowerCase()
    results = results.filter(
      (e) =>
        e.title.toLowerCase().includes(needle) ||
        e.description.toLowerCase().includes(needle) ||
        e.tags.some((tag) => tag.toLowerCase().includes(needle))
    )
  } else {
    results = []
  }

  const heading = tagFilter
    ? t.resultsForTag(tagFilter)
    : query
      ? t.resultsFor(query)
      : t.title

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.title}</h1>
          <p className="text-[var(--muted)]">{t.description}</p>

          {/* The form works without JavaScript — a plain GET form. */}
          <form
            action={`/${locale}/search`}
            method="get"
            className="mt-8 flex gap-3 max-w-2xl"
          >
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t.placeholder}
              className="flex-1 px-4 py-3 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t.search}
            </button>
          </form>
        </section>

        <section className="py-10">
          {query || tagFilter ? (
            <>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="font-serif text-xl" style={{ color: 'var(--foreground-strong)' }}>
                  {heading}
                </h2>
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  {t.count(results.length)}
                </span>
              </div>

              {results.length === 0 ? (
                <p className="text-[var(--muted)] text-center py-20">{t.empty}</p>
              ) : (
                <div className="space-y-0">
                  {results.map((e) => (
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
                          <h3 className="font-serif text-xl md:text-2xl font-medium mb-2 leading-snug group-hover:text-[var(--accent)] transition-colors">
                            {e.title}
                          </h3>
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
            </>
          ) : (
            <div className="py-10">
              <h2 className="font-serif text-xl mb-6" style={{ color: 'var(--foreground-strong)' }}>
                {t.all}
              </h2>
              <div className="flex flex-wrap gap-3">
                {entries.slice(0, 40).map((e) => (
                  <Link
                    key={`${e.kind}-${e.slug}`}
                    href={`/${locale}/${e.kind === 'note' ? 'notes' : 'blog'}/${e.slug}`}
                    className="px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      color: 'var(--muted)',
                      textDecoration: 'none',
                    }}
                  >
                    {e.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}
