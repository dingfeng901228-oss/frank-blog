import { getAllPosts, getAllTags } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import Link from 'next/link'

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

export default async function BlogPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const posts = getAllPosts(locale as Locale)
  const tags = getAllTags(locale as Locale)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        {/* Header */}
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">
            {locale === 'ja' ? 'ブログ' : locale === 'zh' ? '博客' : 'Blog'}
          </h1>
          <p className="text-[var(--muted)]">
            {locale === 'ja'
              ? `${posts.length} 記事を収録`
              : locale === 'zh'
              ? `共 ${posts.length} 篇文章`
              : `${posts.length} posts`}
          </p>
        </section>

        {/* Tags Filter */}
        {tags.length > 0 && (
          <section className="py-8 border-b border-[var(--border)]">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/${locale}/tags?tag=${tag}`}
                  className={`text-xs font-mono px-3 py-1.5 border border-[var(--border)] rounded-full hover:border-[var(--accent)]/30 transition-colors ${
                    topicColors[tag] || 'text-[var(--muted)]'
                  }`}
                >
                  {tag}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Posts List */}
        <section className="py-8">
          <div className="space-y-0">
            {posts.map((post, i) => (
              <article
                key={post.slug}
                className="group py-8 border-b border-[var(--border)] last:border-b-0"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {post.tags?.map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs font-mono ${topicColors[tag] || 'text-[var(--muted)]'}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Link href={`/${locale}/blog/${post.slug}`}>
                      <h2 className="font-serif text-2xl mb-3 group-hover:text-[var(--accent)] transition-colors">
                        {post.title}
                      </h2>
                    </Link>
                    <p className="text-[var(--muted)] mb-4 leading-relaxed">
                      {post.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[var(--muted)] font-mono">
                      <time>{formatDate(post.publishedAt, locale)}</time>
                      <span>·</span>
                      <span>{post.readingTime}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}