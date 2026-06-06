import Link from 'next/link'
import { getAllPosts, getFeaturedPosts } from '@/lib/blog'
import { getAllNotes } from '@/lib/notes'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/home/HeroSection'
import TimelineSection from '@/components/home/TimelineSection'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import type { Post } from '@/lib/types'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const topicColors: Record<string, string> = {
  Tech: 'text-cyan-400',
  AI: 'text-violet-400',
  Life: 'text-emerald-400',
  Japan: 'text-rose-400',
  Notes: 'text-amber-400',
}


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
                  <p className="text-[var(--muted)] text-sm mb-4 line-clamp-2">
                    {post.description}
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
              const kindLabel =
                locale === 'ja'
                  ? item.kind === 'note' ? '随笔' : '記事'
                  : locale === 'zh'
                    ? item.kind === 'note' ? '随笔' : '文章'
                    : item.kind === 'note' ? 'Note' : 'Post'
              const kindColor =
                item.kind === 'note' ? 'text-amber-400/80' : 'text-cyan-400/80'
              return (
                <article key={`${item.kind}-${item.slug}`} className="group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span
                          className={`text-xs font-mono ${kindColor} border border-current/20 rounded-full px-2 py-0.5`}
                        >
                          {kindLabel}
                        </span>
                        {item.tags?.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className={`text-xs font-mono ${topicColors[tag] || 'text-[var(--muted)]'}`}
                          >
                            {tag}
                          </span>
                        ))}
                        <span className="text-xs text-[var(--muted)] font-mono">
                          {formatDate(item.publishedAt, locale)}
                        </span>
                      </div>
                      <Link href={href}>
                        <h3 className="font-serif text-xl mb-2 group-hover:text-[var(--accent)] transition-colors">
                          {item.title}
                        </h3>
                      </Link>
                      <p className="text-[var(--muted)] text-sm line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                    {item.readingTime && (
                      <span className="text-xs text-[var(--muted)] font-mono whitespace-nowrap">
                        {item.readingTime}
                      </span>
                    )}
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
              {locale === 'ja' ? 'すべての随笔 →' : locale === 'zh' ? '查看所有随笔 →' : 'View all notes →'}
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