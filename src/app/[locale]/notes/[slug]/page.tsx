import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getNoteBySlug, getAllNotes } from '@/lib/notes'
import { getAllLocales } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Giscus from '@/components/blog/Giscus'
import Markdown from '@/components/Markdown'
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
  ja: { back: '← ノートに戻る' },
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

  // Render the post body through <Markdown> (react-markdown). This
  // replaces the previous hand-rolled regex splitter, which broke on
  // images sharing a paragraph with surrounding text, on Windows CRLF
  // line endings, and on any future Markdown construct the regex
  // didn't anticipate. See src/components/Markdown.tsx for details.
  const renderedContent = <Markdown>{note.content}</Markdown>

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-reading px-6 pt-20 pb-16">
        <div className="mb-12">
          <Link
            href={`/${locale}/notes`}
            className="text-sm font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {nav.back}
          </Link>
        </div>

        <header className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            {note.tags?.map((tag) => (
              <span key={tag} className="text-xs font-mono text-[var(--accent)]">{tag}</span>
            ))}
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium leading-tight mb-6">{note.title}</h1>
          {note.description && (
            <p className="text-[var(--muted)] text-lg mb-8 leading-relaxed">{note.description}</p>
          )}
          <div className="flex items-center gap-6 text-sm text-[var(--muted)] font-mono">
            <time dateTime={note.publishedAt}>{formatDate(note.publishedAt, locale)}</time>
          </div>
        </header>

        <article className="reading-content">{renderedContent}</article>

        <nav className="mt-20 pt-8 border-t border-[var(--border)] grid grid-cols-2 gap-8">
          <div>
            {prevNote && (
              <Link href={`/${locale}/notes/${prevNote.slug}`} className="block group">
                <span className="text-xs font-mono text-[var(--muted)] mb-2 block">← Previous</span>
                <span className="font-serif text-lg group-hover:text-[var(--accent)] transition-colors">{prevNote.title}</span>
              </Link>
            )}
          </div>
          <div className="text-right">
            {nextNote && (
              <Link href={`/${locale}/notes/${nextNote.slug}`} className="block group">
                <span className="text-xs font-mono text-[var(--muted)] mb-2 block">Next →</span>
                <span className="font-serif text-lg group-hover:text-[var(--accent)] transition-colors">{nextNote.title}</span>
              </Link>
            )}
          </div>
        </nav>

        <section className="mt-20 pt-12 border-t border-[var(--border)]">
          <h2 className="text-xs font-mono text-[var(--muted)] tracking-widest mb-8">
            {locale === 'ja' ? 'コメント' : locale === 'zh' ? '评论' : 'Comments'}
          </h2>
          {/* Prefix with 'note-' so notes and blog posts can never collide
              on the same Giscus discussion term, even if slugs match. */}
          <Giscus term={`note-${slug}`} />
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}