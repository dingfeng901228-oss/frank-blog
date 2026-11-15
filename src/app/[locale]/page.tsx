import Link from 'next/link'
import { getAllPosts, getFeaturedPosts } from '@/lib/blog'
import { getAllNotes } from '@/lib/notes'
import { formatDate, truncate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/home/HeroSection'
import TimelineSection from '@/components/home/TimelineSection'
import { PostMeta } from '@/components/blog/PostCard'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import type { Post } from '@/lib/types'

interface PageProps {
  params: Promise<{ locale: string }>
}

/**
 * How much of a summary the homepage cards show.
 *
 * Item 13: the cards used `line-clamp-2`, which cut the text in the
 * middle of a sentence and — on the first card especially — showed no
 * ellipsis at all, so it looked like the summary simply ended there.
 * The truncation is now done in text, at a sentence boundary, and always
 * ends with "…".
 */
const SUMMARY_LENGTH = 120

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const allPosts = getAllPosts(locale as Locale)
  const allNotes = getAllNotes(locale as Locale)
  const featuredPosts = getFeaturedPosts(locale as Locale, 3)
  // Merge blog + notes, sort by publishedAt desc, take 6
  const latestItems: Array<Post & { kind: 'post' | 'note' }> = [
    ...allPosts.map((p) => ({ ...p, kind: 'post' as const })),
    ...allNotes.map((n) => ({ ...n, kind: 'note' as const })),
  ]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 6)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        {/* ── Hero Section ── */}
        <HeroSection locale={locale} />

        {/* Featured Notes */}
        {featuredPosts.length > 0 && (
          <section className="mb-20">
            <h2 className="text-xs font-mono text-[var(--muted)] tracking-widest mb-8">
              {locale === 'ja' ? '─ 精选 ─' : locale === 'zh' ? '─ 精选 ─' : '─ Featured ─'}
            </h2>
            <div className="grid gap-6">
              {featuredPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/${locale}/blog/${post.slug}`}
                  className="group block p-8 border border-[var(--border)] rounded-xl hover:border-[var(--accent)]/30 transition-colors"
                >
                  <h3 className="font-serif text-2xl mb-3 group-hover:text-[var(--accent)] transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-[var(--muted)] text-sm mb-4">
                    {truncate(post.description, SUMMARY_LENGTH)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-[var(--muted)] font-mono">
                    <span>{formatDate(post.publishedAt, locale)}</span>
                    <span>·</span>
                    <span>{post.readingTime}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Latest (blog + notes merged) */}
        <section className="mb-20">
          <h2 className="text-xs font-mono text-[var(--muted)] tracking-widest mb-8">
            {locale === 'ja' ? '─ 最新 ─' : locale === 'zh' ? '─ 最新 ─' : '─ Latest ─'}
          </h2>
          <div className="grid gap-8">
            {latestItems.map((item) => {
              const href =
                item.kind === 'note'
                  ? `/${locale}/notes/${item.slug}`
                  : `/${locale}/blog/${item.slug}`
              return (
                <article key={`${item.kind}-${item.slug}`} className="group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/*
                       * Item 4: the home cards now use the SAME PostMeta
                       * component as the list pages and the article pages,
                       * so all four surfaces show the same four fields —
                       * category, date, tags, reading time — generated from
                       * the same source. The reading time used to be
                       * parked at the far right of the row, detached from
                       * the date it belongs next to.
                       */}
                      <PostMeta
                        locale={locale as Locale}
                        publishedAt={item.publishedAt}
                        readingTime={item.readingTime}
                        tags={item.tags?.slice(0, 3)}
                        collection={item.kind === 'note' ? 'notes' : 'posts'}
                        variant="inline"
                      />
                      <Link href={href}>
                        <h3 className="font-serif text-xl mt-2 mb-2 group-hover:text-[var(--accent)] transition-colors">
                          {item.title}
                        </h3>
                      </Link>
                      <p className="text-[var(--muted)] text-sm">
                        {truncate(item.description, SUMMARY_LENGTH)}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {/* View All */}
          <div className="mt-12 text-center flex justify-center gap-8">
            <Link
              href={`/${locale}/blog`}
              className="inline-block text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors tracking-wide"
            >
              {locale === 'ja' ? 'すべての記事 →' : locale === 'zh' ? '查看所有文章 →' : 'View all posts →'}
            </Link>
            <Link
              href={`/${locale}/notes`}
              className="inline-block text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors tracking-wide"
            >
              {locale === 'ja' ? 'すべてのノート →' : locale === 'zh' ? '查看所有随笔 →' : 'View all notes →'}
            </Link>
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-20">
          <TimelineSection locale={locale} />
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}