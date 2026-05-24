import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'

const notesContent = {
  ja: {
    title: 'Notes',
    description: '日常の思考、整理されたメモ、考察の断片。',
    placeholder: 'まだ何もありません。',
  },
  zh: {
    title: '随笔',
    description: '日常思考、整理的笔记、考察的片段。',
    placeholder: '暂无内容。',
  },
  en: {
    title: 'Notes',
    description: 'Daily thoughts, organized notes, fragments of reflection.',
    placeholder: 'Nothing here yet.',
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function NotesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = notesContent[locale as keyof typeof notesContent]

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.title}</h1>
          <p className="text-[var(--muted)]">{t.description}</p>
        </section>

        <section className="py-12">
          <p className="text-[var(--muted)] text-center py-20">{t.placeholder}</p>
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}