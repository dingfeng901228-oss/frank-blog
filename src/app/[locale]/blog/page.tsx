import { getAllPosts } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function BlogPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const posts = getAllPosts(locale as Locale)

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

        {/* Posts List */}
        <section className="py-10">
          <div className="space-y-0">
            {posts.map((post, i) => (
              <article
                key={post.slug}
                className="group grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 md:gap-10 py-10 border-b border-[var(--border)] last:border-b-0"
              >
                {/* Left: big date + reading time */}
                <div className="flex flex-col gap-2">
                  <time
                    className="font-serif text-3xl font-medium tabular-nums leading-none"
                    style={{ color: 'var(--foreground-strong)' }}
                  >
                    {formatDate(post.publishedAt, locale)}
                  </time>
                  <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                    {post.readingTime}
                  </span>
                </div>

                {/* Right: title + description */}
                <div className="min-w-0">
                  <Link href={`/${locale}/blog/${post.slug}`}>
                    <h2 className="font-serif text-2xl md:text-3xl font-medium mb-4 leading-snug group-hover:text-[var(--accent)] transition-colors">
                      {post.title}
                    </h2>
                  </Link>
                  <p className="text-[var(--muted)] leading-relaxed text-[15px]">
                    {post.description}
                  </p>
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