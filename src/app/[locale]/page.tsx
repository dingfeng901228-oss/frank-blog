import Link from 'next/link'
import { getAllPosts, getFeaturedPosts } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'

const heroContent = {
  ja: {
    title: 'Notes',
    tagline: '静かに観察し思索する',
  },
  zh: {
    title: '随笔',
    tagline: '安静地观察与思考',
  },
  en: {
    title: 'Journal',
    tagline: 'Thoughts, code, and quiet observations',
  },
}

const topicLabels = {
  ja: ['Tech', 'AI', 'Life', 'Japan', 'Notes'],
  zh: ['技术', 'AI', '生活', '日本', '随笔'],
  en: ['Tech', 'AI', 'Life', 'Japan', 'Notes'],
}

const topicColors: Record<string, string> = {
  Tech: 'text-cyan-400',
  AI: 'text-violet-400',
  Life: 'text-emerald-400',
  Japan: 'text-rose-400',
  Notes: 'text-amber-400',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const hero = heroContent[locale as keyof typeof heroContent]
  const topics = topicLabels[locale as keyof typeof topicLabels]
  const allPosts = getAllPosts(locale as Locale)
  const featuredPosts = getFeaturedPosts(locale as Locale, 3)
  const latestPosts = allPosts.slice(0, 6)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        {/* Hero */}
        <section className="py-20">
          <h1 className="font-serif text-5xl md:text-6xl font-medium tracking-wide mb-4">
            {hero.title}
          </h1>
          <p className="text-[var(--muted)] text-lg font-light">
            {hero.tagline}
          </p>
        </section>

        {/* Topics */}
        <section className="mb-20">
          <div className="flex flex-wrap gap-3">
            {topics.map((topic) => (
              <Link
                key={topic}
                href={`/${locale}/tags?tag=${topic}`}
                className={`${topicColors[topic]} text-sm font-mono tracking-wide px-4 py-2 border border-[var(--border)] rounded-full hover:bg-[var(--muted)]/20 transition-colors`}
              >
                {topic}
              </Link>
            ))}
          </div>
        </section>

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

        {/* Latest Posts */}
        <section className="mb-20">
          <h2 className="text-xs font-mono text-[var(--muted)] tracking-widest mb-8">
            {locale === 'ja' ? '─ 最新 ─' : locale === 'zh' ? '─ 最新 ─' : '─ Latest ─'}
          </h2>
          <div className="grid gap-8">
            {latestPosts.map((post) => (
              <article key={post.slug} className="group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {post.tags?.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs font-mono ${topicColors[tag] || 'text-[var(--muted)]'}`}
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="text-xs text-[var(--muted)] font-mono">
                        {formatDate(post.publishedAt, locale)}
                      </span>
                    </div>
                    <Link href={`/${locale}/blog/${post.slug}`}>
                      <h3 className="font-serif text-xl mb-2 group-hover:text-[var(--accent)] transition-colors">
                        {post.title}
                      </h3>
                    </Link>
                    <p className="text-[var(--muted)] text-sm line-clamp-2">
                      {post.description}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--muted)] font-mono whitespace-nowrap">
                    {post.readingTime}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {/* View All */}
          <div className="mt-12 text-center">
            <Link
              href={`/${locale}/blog`}
              className="inline-block text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors tracking-wide"
            >
              {locale === 'ja' ? 'すべて見る →' : locale === 'zh' ? '查看全部 →' : 'View all →'}
            </Link>
          </div>
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}