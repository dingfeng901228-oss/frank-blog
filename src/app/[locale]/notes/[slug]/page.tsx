import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getNoteBySlug, getAllNotes } from '@/lib/notes'
import { getAllLocales } from '@/lib/blog'
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
    const notes = getAllNotes(locale as Locale)
    for (const note of notes) {
      params.push({ locale, slug: note.slug })
    }
  }

  return params
}

const navLabels = {
  ja: { back: '← ノート一覧' },
  zh: { back: '← 返回随笔' },
  en: { back: '← Back to Notes' },
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params
  const note = getNoteBySlug(locale as Locale, slug)

  if (!note) return { title: 'Not Found' }

  return {
    title: note.title,
    description: note.description,
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/notes/${slug}`,
      languages: {
        'ja': `https://blog.frank2025.com/ja/notes/${slug}`,
        'zh': `https://blog.frank2025.com/zh/notes/${slug}`,
        'en': `https://blog.frank2025.com/en/notes/${slug}`,
        'x-default': `https://blog.frank2025.com/ja/notes/${slug}`,
      },
    },
    openGraph: {
      title: note.title,
      description: note.description,
      locale: locale === 'ja' ? 'ja_JP' : locale === 'zh' ? 'zh_CN' : 'en_US',
      type: 'article',
      publishedTime: note.publishedAt,
      modifiedTime: note.updatedAt,
      tags: note.tags,
      url: `https://blog.frank2025.com/${locale}/notes/${slug}`,
      images: note.coverImage
        ? [{ url: note.coverImage, width: 1200, height: 630, alt: note.title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: note.title,
      description: note.description,
    },
  }
}

export default async function NotePage({ params }: PageProps) {
  const { locale, slug } = await params
  setRequestLocale(locale as Locale)

  const note = getNoteBySlug(locale as Locale, slug)
  if (!note) notFound()

  const allNotes = getAllNotes(locale as Locale)
  const currentIndex = allNotes.findIndex((n) => n.slug === slug)
  const prevNote = currentIndex < allNotes.length - 1 ? allNotes[currentIndex + 1] : null
  const nextNote = currentIndex > 0 ? allNotes[currentIndex - 1] : null

  const nav = navLabels[locale as keyof typeof navLabels]
  const renderedContent = <Markdown>{note.content}</Markdown>

  // JSON-LD structured data for SEO (Article + BreadcrumbList)
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: note.title,
    description: note.description,
    datePublished: note.publishedAt,
    dateModified: note.updatedAt ?? note.publishedAt,
    inLanguage: locale,
    url: `https://blog.frank2025.com/${locale}/notes/${slug}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://blog.frank2025.com/${locale}/notes/${slug}`,
    },
    image: note.coverImage
      ? [`https://blog.frank2025.com${note.coverImage}`]
      : ['https://blog.frank2025.com/og-image.jpg'],
    author: {
      '@type': 'Person',
      name: 'Ding Feng',
      alternateName: 'Frank Ding',
      url: 'https://blog.frank2025.com',
    },
    publisher: {
      '@type': 'Person',
      name: 'Frank Ding',
      url: 'https://blog.frank2025.com',
    },
    keywords: note.tags?.join(', '),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'ja' ? 'ホーム' : locale === 'zh' ? '首页' : 'Home',
        item: `https://blog.frank2025.com/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: locale === 'ja' ? 'ノート' : locale === 'zh' ? '随笔' : 'Notes',
        item: `https://blog.frank2025.com/${locale}/notes`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: note.title,
        item: `https://blog.frank2025.com/${locale}/notes/${slug}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="min-h-screen">
        <Navbar locale={locale as Locale} />

        <main className="article-page-wrapper">
          {/* Back link */}
          <div className="mb-8 lg:mb-12">
            <Link
              href={`/${locale}/notes`}
              className="text-xs font-mono transition-colors hover:text-white"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              {nav.back}
            </Link>
          </div>

          {/* Header */}
          <header className="mb-10 lg:mb-12 lg:col-span-3">
            {note.tags && note.tags.length > 0 && (
              <div className="flex items-center gap-3 mb-5">
                {note.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-mono px-2.5 py-0.5 rounded-full" style={{
                    background: 'rgba(59,130,246,0.10)',
                    border: '1px solid rgba(59,130,246,0.15)',
                    color: 'rgba(147,197,253,0.9)',
                  }}>{tag}</span>
                ))}
              </div>
            )}
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-medium leading-tight mb-5 text-white">
              {note.title}
            </h1>
            {note.description && (
              <p className="text-base lg:text-lg leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {note.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <time dateTime={note.publishedAt}>{formatDate(note.publishedAt, locale)}</time>
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
                publishedAt={note.publishedAt}
                tags={note.tags}
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
              {prevNote && (
                <Link href={`/${locale}/notes/${prevNote.slug}`} className="block group">
                  <span className="text-[10px] font-mono tracking-wider mb-2 block" style={{ color: 'rgba(255,255,255,0.35)' }}>← Previous</span>
                  <span className="text-sm font-serif group-hover:text-[var(--accent)] transition-colors text-white/80">{prevNote.title}</span>
                </Link>
              )}
            </div>
            <div className="text-right">
              {nextNote && (
                <Link href={`/${locale}/notes/${nextNote.slug}`} className="block group">
                  <span className="text-[10px] font-mono tracking-wider mb-2 block" style={{ color: 'rgba(255,255,255,0.35)' }}>Next →</span>
                  <span className="text-sm font-serif group-hover:text-[var(--accent)] transition-colors text-white/80">{nextNote.title}</span>
                </Link>
              )}
            </div>
          </nav>

          {/* Comments */}
          <section className="pt-12 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h2 className="text-[10px] font-mono tracking-[0.18em] mb-8 uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {locale === 'ja' ? 'コメント' : locale === 'zh' ? '评论' : 'Comments'}
            </h2>
            {/* Prefix with 'note-' so notes and blog posts can never collide
                on the same Giscus discussion term, even if slugs match. */}
            <Giscus term={`note-${slug}`} />
          </section>
        </main>

        <Footer locale={locale as Locale} />
      </div>
    </>
  )
}