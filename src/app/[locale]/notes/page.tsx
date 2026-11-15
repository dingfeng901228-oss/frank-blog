import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import { getNotes } from '@/lib/notes'
import { PostCard } from '@/components/blog/PostCard'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params

  const meta = {
    ja: {
      title: 'ノート一覧',
      description: '日常の思考、整理されたメモ、考察の断片。Ding Feng のノート。',
    },
    zh: {
      title: '随笔列表',
      description: '日常思考、整理的笔记、考察的片段。Ding Feng 的随笔。',
    },
    en: {
      title: 'Notes',
      description: 'Notes by Ding Feng. Daily thoughts, organized notes, fragments of reflection.',
    },
  }

  const t = meta[locale as keyof typeof meta] ?? meta.ja

  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: `${t.title} — Frank Ding`,
      description: t.description,
      url: `https://blog.frank2025.com/${locale}/notes`,
    },
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/notes`,
    },
  }
}

const notesLabels = {
  ja: { title: 'ノート', description: '日常の思考、整理されたメモ、考察の断片。' },
  zh: { title: '随笔', description: '日常思考、整理的笔记、考察的片段。' },
  en: { title: 'Notes', description: 'Daily thoughts, organized notes, fragments of reflection.' },
}

export default async function NotesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = notesLabels[locale as keyof typeof notesLabels]
  const notes = await getNotes(locale as Locale)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        {/* Header — same shape as the blog list, including the count */}
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.title}</h1>
          <p className="text-[var(--muted)]">
            {locale === 'ja'
              ? `${notes.length} 件のノートを収録`
              : locale === 'zh'
                ? `共 ${notes.length} 篇随笔`
                : `${notes.length} notes`}
          </p>
        </section>

        {/* Notes list — same card style as the blog list */}
        <section className="py-10">
          {notes.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-20">
              {locale === 'ja' ? 'まだノートがありません。' : locale === 'zh' ? '暂无内容。' : 'No notes yet.'}
            </p>
          ) : (
            <div className="space-y-0">
              {notes.map((note) => (
                <PostCard
                  key={note.slug}
                  locale={locale as Locale}
                  slug={note.slug}
                  title={note.title}
                  description={note.description}
                  publishedAt={note.publishedAt}
                  readingTime={note.readingTime}
                  tags={note.tags}
                  collection="notes"
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}
