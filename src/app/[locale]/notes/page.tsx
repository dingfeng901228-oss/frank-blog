import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import { getNotes } from '@/lib/notes'
import Link from 'next/link'

const notesLabels = {
  ja: { title: 'Notes', description: '日常の思考、整理されたメモ、考察の断片。', readMore: '読む' },
  zh: { title: '随笔', description: '日常思考、整理的笔记、考察的片段。', readMore: '阅读' },
  en: { title: 'Notes', description: 'Daily thoughts, organized notes, fragments of reflection.', readMore: 'Read' },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function NotesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = notesLabels[locale as keyof typeof notesLabels]
  const notes = await getNotes(locale as Locale)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.title}</h1>
          <p className="text-[var(--muted)]">{t.description}</p>
        </section>

        <section className="py-12">
          {notes.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-20">暂无内容。</p>
          ) : (
            <div className="space-y-8">
              {notes.map((note) => (
                <article key={note.slug} className="border-b border-[var(--border)] pb-8">
                  <Link href={`/${locale}/notes/${note.slug}`}>
                    <h2 className="font-serif text-2xl font-medium mb-3 hover:text-[var(--accent)] transition-colors">{note.title}</h2>
                  </Link>
                  {note.description && (
                    <p className="text-[var(--muted)] mb-3 leading-relaxed">{note.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
                    <time>{note.publishedAt}</time>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex gap-2">
                        {note.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-[var(--card)] rounded text-xs">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}