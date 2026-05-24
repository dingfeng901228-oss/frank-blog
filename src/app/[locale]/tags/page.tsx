import { getAllTags, getPostsByTag } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import Link from 'next/link'
import { Suspense } from 'react'

const topicColors: Record<string, string> = {
  Tech: 'text-cyan-400',
  AI: 'text-violet-400',
  Life: 'text-emerald-400',
  Japan: 'text-rose-400',
  Notes: 'text-amber-400',
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tag?: string }>
}

export default async function TagsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { tag } = await searchParams
  setRequestLocale(locale as Locale)

  const tags = getAllTags(locale as Locale)

  const labels = {
    ja: { title: 'タグ', all: 'すべて', posts: '件' },
    zh: { title: '标签', all: '全部', posts: '篇' },
    en: { title: 'Tags', all: 'All', posts: 'posts' },
  }
  const l = labels[locale as keyof typeof labels]

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{l.title}</h1>
        </section>

        {/* Tag Filter */}
        <section className="py-8 border-b border-[var(--border)]">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${locale}/tags`}
              className={`text-xs font-mono px-3 py-1.5 border rounded-full transition-colors ${
                !tag
                  ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30'
              }`}
            >
              {l.all}
            </Link>
            {tags.map((t) => (
              <Link
                key={t}
                href={`/${locale}/tags?tag=${t}`}
                className={`text-xs font-mono px-3 py-1.5 border rounded-full transition-colors ${
                  tag === t
                    ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                    : `border-[var(--border)] ${topicColors[t] || 'text-[var(--muted)]'} hover:border-[var(--accent)]/30`
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        </section>

        {/* Posts for Tag */}
        <section className="py-8">
          {tag ? (
            <div className="space-y-0">
              {getPostsByTag(locale as Locale, tag).map((post) => (
                <article
                  key={post.slug}
                  className="group py-8 border-b border-[var(--border)] last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
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
          ) : (
            <p className="text-[var(--muted)] py-20 text-center">
              {locale === 'ja' ? 'タグを選択してください' : locale === 'zh' ? '请选择标签' : 'Select a tag'}
            </p>
          )}
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}