// src/app/[locale]/blog/tag/[tag]/page.tsx
//
// Tag-filtered list of blog posts. Tags are extracted at SSG time and
// `generateStaticParams` returns every (locale, tag) combination so the
// static export can produce one page per tag. Unknown tags return 404 —
// this is fine because the only way to reach this page is to click a tag
// somewhere on the site, and those are all real, declared tags.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllPosts, getAllLocales } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string; tag: string }>
}

const titleByLocale = {
  ja: { heading: (tag: string) => `「${tag}」の記事`, empty: '該当する記事がありません。' },
  zh: { heading: (tag: string) => `标签：${tag}`, empty: '没有找到相关文章。' },
  en: { heading: (tag: string) => `Tag: ${tag}`, empty: 'No posts found for this tag.' },
}

export async function generateStaticParams() {
  const { getAllTags } = await import('@/lib/blog')
  const locales = getAllLocales() as unknown as string[]
  const params: { locale: string; tag: string }[] = []

  for (const locale of locales) {
    const tags = getAllTags(locale as Locale)
    for (const tag of tags) {
      // URL-encode once so build-time paths and runtime requests agree.
      params.push({ locale, tag: encodeURIComponent(tag) })
    }
  }
  return params
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, tag } = await params
  const decoded = decodeURIComponent(tag)
  return {
    title: titleByLocale[locale as keyof typeof titleByLocale].heading(decoded),
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/blog/tag/${encodeURIComponent(decoded)}`,
    },
  }
}

export default async function TagFilteredBlogPage({ params }: PageProps) {
  const { locale, tag } = await params
  setRequestLocale(locale as Locale)

  const decoded = decodeURIComponent(tag)
  const allPosts = getAllPosts(locale as Locale)
  const posts = allPosts.filter((p) => p.tags?.includes(decoded))
  if (posts.length === 0) notFound()

  const t = titleByLocale[locale as keyof typeof titleByLocale]
  const backLink = locale === 'ja' ? '← ブログ一覧' : locale === 'zh' ? '← 返回博客' : '← Back to Blog'

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        <div className="mb-8 lg:mb-12">
          <Link href={`/${locale}/blog`} className="text-xs font-mono transition-colors hover:text-[var(--accent)]" style={{ color: 'var(--muted)' }}>
            {backLink}
          </Link>
        </div>

        <section className="py-12 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.heading(decoded)}</h1>
          <p className="text-[var(--muted)]">
            {locale === 'ja' ? `${posts.length} 記事を収録` : locale === 'zh' ? `共 ${posts.length} 篇文章` : `${posts.length} posts`}
          </p>
        </section>

        <section className="py-10">
          <div className="space-y-0">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 md:gap-10 py-10 border-b border-[var(--border)] last:border-b-0"
              >
                <div className="flex flex-col gap-2">
                  <time className="font-serif text-3xl font-medium tabular-nums leading-none" style={{ color: 'var(--foreground-strong)' }}>
                    {formatDate(post.publishedAt, locale)}
                  </time>
                  <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                    {post.readingTime}
                  </span>
                </div>

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
