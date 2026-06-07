import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostBySlug, getAllPosts, getAllLocales } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Giscus from '@/components/blog/Giscus'
import Markdown from '@/components/Markdown'
import ArticleTOC from '@/components/blog/ArticleTOC'
import ArticleSidebar from '@/components/blog/ArticleSidebar'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
  const locales = getAllLocales()
  const params: { locale: string; slug: string }[] = []

  for (const locale of locales) {
    const posts = getAllPosts(locale as Locale)
    for (const post of posts) {
      params.push({ locale, slug: post.slug })
    }
  }

  return params
}

const navLabels = {
  ja: { back: '← ブログ一覧' },
  zh: { back: '← 返回博客' },
  en: { back: '← Back to Blog' },
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params
  const post = getPostBySlug(locale as Locale, slug)

  if (!post) return { title: 'Not Found' }

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      locale: locale === 'ja' ? 'ja_JP' : locale === 'zh' ? 'zh_CN' : 'en_US',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      tags: post.tags,
      url: `https://blog.frank2025.com/${locale}/blog/${slug}`,
      images: post.coverImage
        ? [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  }
}

export default async function PostPage({ params }: PageProps) {
  const { locale, slug } = await params
  setRequestLocale(locale as Locale)

  const post = getPostBySlug(locale as Locale, slug)
  if (!post) notFound()

  const allPosts = getAllPosts(locale as Locale)
  const currentIndex = allPosts.findIndex((p) => p.slug === slug)
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null

  const nav = navLabels[locale as keyof typeof navLabels]
  const renderedContent = <Markdown>{post.content}</Markdown>

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="article-page-wrapper">
        {/* Back link */}
        <div className="mb-8 lg:mb-12">
          <Link
            href={`/${locale}/blog`}
            className="text-xs font-mono transition-colors hover:text-white"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {nav.back}
          </Link>
        </div>

        {/* Header */}
        <header className="mb-10 lg:mb-12 lg:col-span-3">
          {post.tags && post.tags.length > 0 && (
            <div className="flex items-center gap-3 mb-5">
              {post.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-mono px-2.5 py-0.5 rounded-full" style={{
                  background: 'rgba(59,130,246,0.10)',
                  border: '1px solid rgba(59,130,246,0.15)',
                  color: 'rgba(147,197,253,0.9)',
                }}>{tag}</span>
              ))}
            </div>
          )}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-medium leading-tight mb-5 text-white">
            {post.title}
          </h1>
          {post.description && (
            <p className="text-base lg:text-lg leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {post.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
            {post.readingTime && (
              <>
                <span>·</span>
                <span>{post.readingTime}</span>
              </>
            )}
          </div>
        </header>

        {/* Three-column layout */}
        <div className="article-three-col">
          {/* Left: TOC */}
          <div className="article-toc-col">
            <ArticleTOC />
          </div>

          {/* Center: Content */}
          <article className="reading-content min-w-0">
            {renderedContent}
          </article>

          {/* Right: Sidebar */}
          <div className="article-sidebar-col">
            <ArticleSidebar
              locale={locale}
              publishedAt={post.publishedAt}
              readingTime={post.readingTime}
              tags={post.tags}
            />
          </div>
        </div>

        {/* Divider */}
        {renderedContent && (
          <div className="mt-16 mb-12 h-px w-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
        )}

        {/* Prev / Next nav */}
        <nav className="grid grid-cols-2 gap-8 mb-16">
          <div>
            {prevPost && (
              <Link href={`/${locale}/blog/${prevPost.slug}`} className="block group">
                <span className="text-[10px] font-mono tracking-wider mb-2 block" style={{ color: 'rgba(255,255,255,0.35)' }}>← Previous</span>
                <span className="text-sm font-serif group-hover:text-[var(--accent)] transition-colors text-white/80">{prevPost.title}</span>
              </Link>
            )}
          </div>
          <div className="text-right">
            {nextPost && (
              <Link href={`/${locale}/blog/${nextPost.slug}`} className="block group">
                <span className="text-[10px] font-mono tracking-wider mb-2 block" style={{ color: 'rgba(255,255,255,0.35)' }}>Next →</span>
                <span className="text-sm font-serif group-hover:text-[var(--accent)] transition-colors text-white/80">{nextPost.title}</span>
              </Link>
            )}
          </div>
        </nav>

        {/* Comments */}
        <section className="pt-12 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h2 className="text-[10px] font-mono tracking-[0.18em] mb-8 uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {locale === 'ja' ? 'コメント' : locale === 'zh' ? '评论' : 'Comments'}
          </h2>
          <Giscus term={slug} />
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}
