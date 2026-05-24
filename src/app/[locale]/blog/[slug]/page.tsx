import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostBySlug, getAllPosts, getAllLocales } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Giscus from '@/components/blog/Giscus'
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
  ja: { back: '← ブログに戻る' },
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
    openGraph: {
      title: post.title,
      description: post.description,
      locale: locale === 'ja' ? 'ja_JP' : locale === 'zh' ? 'zh_CN' : 'en_US',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      tags: post.tags,
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

  const paragraphs = post.content.split('\n\n').filter(p => p.trim())
  const renderedContent = paragraphs.map((para, i) => {
    if (para.startsWith('## ')) return <h2 key={i} className="font-serif text-2xl font-medium mt-10 mb-4">{para.slice(3)}</h2>
    if (para.startsWith('# ')) return <h1 key={i} className="font-serif text-3xl font-medium mt-12 mb-6">{para.slice(2)}</h1>
    if (para.startsWith('```')) return <pre key={i} className="bg-[var(--muted)] rounded-lg p-4 my-6 overflow-x-auto text-sm font-mono"><code>{para.replace(/```\w*\n?/g, '')}</code></pre>
    return <p key={i} className="my-5">{para}</p>
  })

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-reading px-6 pt-20 pb-16">
        <div className="mb-12">
          <Link
            href={`/${locale}/blog`}
            className="text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {nav.back}
          </Link>
        </div>

        <header className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            {post.tags?.map((tag) => (
              <span key={tag} className="text-xs font-mono text-[var(--accent)]">{tag}</span>
            ))}
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium leading-tight mb-6">{post.title}</h1>
          <p className="text-[var(--muted)] text-lg mb-8 leading-relaxed">{post.description}</p>
          <div className="flex items-center gap-6 text-sm text-[var(--muted)] font-mono">
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
            <span>·</span>
            <span>{post.readingTime}</span>
          </div>
        </header>

        <article className="reading-content">{renderedContent}</article>

        <nav className="mt-20 pt-8 border-t border-[var(--border)] grid grid-cols-2 gap-8">
          <div>
            {prevPost && (
              <Link href={`/${locale}/blog/${prevPost.slug}`} className="block group">
                <span className="text-xs font-mono text-[var(--muted)] mb-2 block">← Previous</span>
                <span className="font-serif text-lg group-hover:text-[var(--accent)] transition-colors">{prevPost.title}</span>
              </Link>
            )}
          </div>
          <div className="text-right">
            {nextPost && (
              <Link href={`/${locale}/blog/${nextPost.slug}`} className="block group">
                <span className="text-xs font-mono text-[var(--muted)] mb-2 block">Next →</span>
                <span className="font-serif text-lg group-hover:text-[var(--accent)] transition-colors">{nextPost.title}</span>
              </Link>
            )}
          </div>
        </nav>

        <section className="mt-20 pt-12 border-t border-[var(--border)]">
          <h2 className="text-xs font-mono text-[var(--muted)] tracking-widest mb-8">Comments</h2>
          <Giscus term={slug} />
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}