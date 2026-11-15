/**
 * The search form and its results.
 *
 * WHY THIS IS A CLIENT COMPONENT
 * ------------------------------
 * `output: 'export'` builds a purely static site, and a server component
 * that awaits `searchParams` cannot be prerendered — Next.js fails the
 * build with "Route /[locale]/search with `dynamic = "error"` couldn't be
 * rendered statically because it used `await searchParams`".
 *
 * Reading the query string in the browser instead keeps the page a static
 * file that works without a server, and the markup is unchanged: the same
 * elements, the same classes, the same copy. The form still works without
 * JavaScript, because it is a plain GET form that the browser submits to
 * the same URL.
 */
'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { tagHref } from '@/lib/tags'
import { copy } from './copy'
import type { ArchiveEntry } from '@/lib/archive'

interface Props {
  locale: string
  entries: ArchiveEntry[]
}

function SearchResults({ locale, entries }: Props) {
  const searchParams = useSearchParams()
  const t = copy[locale as keyof typeof copy] ?? copy.ja

  const query = (searchParams.get('q') ?? '').trim()
  const tagFilter = (searchParams.get('tag') ?? '').trim()

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
    <>
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
    </>
  )
}

export default function SearchApp(props: Props) {
  return (
    <Suspense fallback={null}>
      <SearchResults {...props} />
    </Suspense>
  )
}
