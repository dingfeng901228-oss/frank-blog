import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import type { Locale } from '@/i18n/config'
import { tagHref } from '@/lib/tags'

/**
 * Shared labels for the post surfaces. Every list page and card uses
 * these so a term is never spelled two ways in two places.
 */
export const postLabels: Record<
  Locale,
  {
    blog: string
    note: string
    readingTime: string
    readMore: string
    minutes: string
  }
> = {
  ja: {
    blog: '記事',
    note: 'ノート',
    readingTime: '読了',
    readMore: '続きを読む',
    minutes: '分',
  },
  zh: {
    blog: '文章',
    note: '随笔',
    readingTime: '阅读',
    readMore: '继续阅读',
    minutes: '分钟',
  },
  en: {
    blog: 'Post',
    note: 'Note',
    readingTime: 'Read',
    readMore: 'Read more',
    minutes: 'min',
  },
}

/**
 * The "date + category + tags + reading time" metadata row.
 *
 * Item 4 of the cleanup: every surface (home card, blog list, notes list,
 * article page) shows the SAME four fields, generated from the SAME
 * source. Before this, reading time and tags only appeared on one kind of
 * surface, and the home card parked the reading time at the far right of
 * the row where it looked detached.
 *
 * `variant="inline"` puts the reading time directly after the date (the
 * home card). `variant="stack"` puts date+reading on one line and the
 * tags below (the article page). `variant="card"` leaves the date and
 * reading time out entirely — the list cards show those in their own
 * date column, and repeating them here would read as a duplication.
 */
export function PostMeta({
  locale,
  publishedAt,
  readingTime,
  tags,
  collection,
  variant = 'inline',
  linkTags = true,
}: {
  locale: Locale
  publishedAt: string
  readingTime?: string
  tags?: string[]
  collection: 'posts' | 'notes'
  variant?: 'inline' | 'stack' | 'card'
  linkTags?: boolean
}) {
  const t = postLabels[locale] ?? postLabels.ja
  const kindLabel = collection === 'notes' ? t.note : t.blog
  const kindColor = collection === 'notes' ? 'text-amber-400/80' : 'text-cyan-400/80'

  const dateAndTime = (
    <>
      <span className="text-xs text-[var(--muted)] font-mono whitespace-nowrap">
        {formatDate(publishedAt, locale)}
      </span>
      {readingTime && (
        <>
          <span className="text-xs text-[var(--muted)]/60">·</span>
          <span className="text-xs text-[var(--muted)] font-mono whitespace-nowrap">
            {readingTime}
          </span>
        </>
      )}
    </>
  )

  const tagList = tags && tags.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) =>
        linkTags ? (
          <Link
            key={tag}
            href={tagHref(locale, collection === 'notes' ? 'notes' : 'blog', tag)}
            className="text-xs font-mono px-2 py-0.5 bg-[var(--card)] rounded transition-colors hover:text-[var(--accent)]"
            style={{ color: 'var(--muted)' }}
          >
            {tag}
          </Link>
        ) : (
          <span
            key={tag}
            className="text-xs font-mono px-2 py-0.5 bg-[var(--card)] rounded"
            style={{ color: 'var(--muted)' }}
          >
            {tag}
          </span>
        )
      )}
    </div>
  ) : null

  if (variant === 'card') {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`text-xs font-mono ${kindColor} border border-current/20 rounded-full px-2 py-0.5`}
        >
          {kindLabel}
        </span>
        {tagList}
      </div>
    )
  }

  if (variant === 'stack') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`text-xs font-mono ${kindColor} border border-current/20 rounded-full px-2 py-0.5`}
          >
            {kindLabel}
          </span>
          {dateAndTime}
        </div>
        {tagList}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className={`text-xs font-mono ${kindColor} border border-current/20 rounded-full px-2 py-0.5`}
      >
        {kindLabel}
      </span>
      {dateAndTime}
      {tagList}
    </div>
  )
}

/**
 * The shared list-card used by /blog and /notes.
 *
 * Item 5: the two list pages used two completely different layouts (the
 * blog list had a big left-hand date column, the notes list had a plain
 * stacked list). This component is the single card style both use.
 *
 * Item 3: the date is ONE string in the site-wide format ("2026年9月30日")
 * with `whitespace-nowrap`, so it can never wrap mid-date the way the old
 * "2026年8月／19日" block did.
 */
export function PostCard({
  locale,
  slug,
  title,
  description,
  publishedAt,
  readingTime,
  tags,
  collection,
}: {
  locale: Locale
  slug: string
  title: string
  description: string
  publishedAt: string
  readingTime?: string
  tags?: string[]
  collection: 'posts' | 'notes'
}) {
  const base = collection === 'notes' ? 'notes' : 'blog'
  const href = `/${locale}/${base}/${slug}`

  return (
    <article className="group grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 md:gap-10 py-10 border-b border-[var(--border)] last:border-b-0">
      {/* Left: the date, in the site-wide format, on one line */}
      <div className="flex flex-col gap-1 md:items-start">
        <time
          dateTime={publishedAt}
          className="text-sm font-mono whitespace-nowrap"
          style={{ color: 'var(--foreground-strong)' }}
        >
          {formatDate(publishedAt, locale)}
        </time>
        {readingTime && (
          <span
            className="text-xs font-mono whitespace-nowrap"
            style={{ color: 'var(--muted)' }}
          >
            {readingTime}
          </span>
        )}
      </div>

      {/* Right: title + description + meta */}
      <div className="min-w-0">
        <Link href={href}>
          <h2 className="font-serif text-2xl md:text-3xl font-medium mb-4 leading-snug group-hover:text-[var(--accent)] transition-colors">
            {title}
          </h2>
        </Link>
        {description && (
          <p className="text-[var(--muted)] leading-relaxed text-[15px] mb-4">
            {description}
          </p>
        )}
        <PostMeta
          locale={locale}
          publishedAt={publishedAt}
          readingTime={readingTime}
          tags={tags}
          collection={collection}
          variant="card"
        />
      </div>
    </article>
  )
}
