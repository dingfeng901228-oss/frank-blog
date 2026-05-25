import { getAllTags, getPostsByTag, getAllLocales } from '@/lib/blog'
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
  params: Promise<{ locale: string; tag: string }>
}

export async function generateStaticParams() {
  const locales = getAllLocales()
  const params: { locale: string; tag: string }[] = []

  for (const locale of locales) {
    const tags = getAllTags(locale as Locale)
    for (const tag of tags) {
      params.push({ locale, tag })
    }
  }

  return params
}

export default async function TagPage({ params }: PageProps) {
  const { locale, tag } = await params
  setRequestLocale(locale as Locale)

  const posts = getPostsByTag(locale as Locale, tag)
  const allTags = getAllTags(locale as Locale)

  const labels = {
    ja: { title: 'タグ', back: '← タグ一覧に戻る' },
    zh: { title: '标签', back: '← 返回标签' },
    en: { title: 'Tags', back: '← Back to Tags' },
  }
  const l = labels[locale as keyof typeof labels]

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <section className="py-16 border-b border-[var(--border)]">
          <Link
            href={`/${locale}/tags`}
            className="text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-6 inline-block"
          >
            {l.back}
          </Link>
          <h1 className={`font-serif text-4xl font-medium mb-4 mt-4 ${topicColors[tag] || ''}`}>
            {tag}
          </h1>
          <p className="text-[var(--muted)]">
            {posts.length} {locale === 'ja' ? '件' : locale === 'zh' ? '篇' : 'posts'}
          </p>
        </section>

        <section className="py-8 border-b border-[var(--border)]">
          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => (
              <Link
                key={t}
                href={`/${locale}/tags/${t}`}
                className={`text-xs font-mono px-3 py-1.5 border rounded-full transition-colors ${
                  t === tag
                    ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                    : `border-[var(--border)] ${topicColors[t] || 'text-[var(--muted)]'} hover:border-[var(--accent)]/30`
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        </section>

        <section className="py-8">
          {posts.length > 0 ? (
            <div className="space-y-0">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="group py-8 border-b border-[var(--border)] last:border-b-0"
                >
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
                </article>
              ))}
            </div>
          ) : (
            <p className="text-[var(--muted)] py-20 text-center">
              {locale === 'ja' ? '記事がありません' : locale === 'zh' ? '暂无文章' : 'No posts'}
            </p>
          )}
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}