// src/app/[locale]/notes/tag/[tag]/page.tsx
//
// Tag-filtered list of notes. Same shape as the blog tag page. Tags are
// extracted at SSG time so the static export can materialise one HTML
// file per (locale, tag) pair.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllLocales } from '@/lib/blog'
import { getAllNotes, getAllNoteTags } from '@/lib/notes'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string; tag: string }>
}

const titleByLocale = {
  ja: { heading: (tag: string) => `「${tag}」のノート`, empty: '該当するノートがありません。' },
  zh: { heading: (tag: string) => `标签：${tag}`, empty: '没有找到相关随笔。' },
  en: { heading: (tag: string) => `Tag: ${tag}`, empty: 'No notes found for this tag.' },
}

export async function generateStaticParams() {
  const locales = getAllLocales() as unknown as string[]
  const params: { locale: string; tag: string }[] = []

  for (const locale of locales) {
    const tags = getAllNoteTags(locale as Locale)
    for (const tag of tags) {
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
      canonical: `https://blog.frank2025.com/${locale}/notes/tag/${encodeURIComponent(decoded)}`,
    },
  }
}

export default async function TagFilteredNotesPage({ params }: PageProps) {
  const { locale, tag } = await params
  setRequestLocale(locale as Locale)

  const decoded = decodeURIComponent(tag)
  const allNotes = getAllNotes(locale as Locale)
  const notes = allNotes.filter((n) => n.tags?.includes(decoded))
  if (notes.length === 0) notFound()

  const t = titleByLocale[locale as keyof typeof titleByLocale]
  const backLink = locale === 'ja' ? '← ノート一覧' : locale === 'zh' ? '← 返回随笔' : '← Back to Notes'

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        <div className="mb-8 lg:mb-12">
          <Link href={`/${locale}/notes`} className="text-xs font-mono transition-colors hover:text-[var(--accent)]" style={{ color: 'var(--muted)' }}>
            {backLink}
          </Link>
        </div>

        <section className="py-12 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.heading(decoded)}</h1>
          <p className="text-[var(--muted)]">
            {locale === 'ja' ? `${notes.length} 件のノート` : locale === 'zh' ? `共 ${notes.length} 篇随笔` : `${notes.length} notes`}
          </p>
        </section>

        <section className="py-12">
          <div className="space-y-8">
            {notes.map((note) => (
              <article key={note.slug} className="border-b border-[var(--border)] pb-8">
                <Link href={`/${locale}/notes/${note.slug}`}>
                  <h2 className="font-serif text-2xl font-medium mb-3 hover:text-[var(--accent)] transition-colors">
                    {note.title}
                  </h2>
                </Link>
                {note.description && (
                  <p className="text-[var(--muted)] mb-3 leading-relaxed">{note.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
                  <time>{note.publishedAt}</time>
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
