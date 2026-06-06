import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'

const aboutContent = {
  ja: {
    title: 'About',
    intro: `Frank Ding / 東京都在住 / エンジニア`,
    description: `このサイトは、静かに観察し思索したことを記録するための場所。日々の技術メモ、AIと自動化の実践、日本での生活、そして人生についての考察を残す。`,
    philosophy: `技術は問題を解決する手段であり、目的ではない。複雑なシステムをシンプルに保ち、読む人にとって価値ある情報だけを届けることを大切にしている。`,
    contact: 'メール: dingfeng901112@gmail.com',
  },
  zh: {
    title: '关于',
    intro: 'Frank Ding / 东京 / 工程师',
    description: '这个网站是记录安静观察与思考的空间。保留日常技术笔记、AI与自动化实践、日本生活以及人生观察。',
    philosophy: '技术是解决问题的手段，而非目的。我重视保持复杂系统的简洁，只传递对读者有价值的信息。',
    contact: '邮箱: dingfeng901112@gmail.com',
  },
  en: {
    title: 'About',
    intro: 'Frank Ding / Tokyo / Engineer',
    description: `This site is a space for quiet observation and thinking. I write about daily tech notes, AI and automation practices, life in Japan, and reflections on life.`,
    philosophy: `Technology is a means to solve problems, not an end in itself. I value keeping complex systems simple and delivering only information that is valuable to the reader.`,
    contact: 'Email: dingfeng901112@gmail.com',
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const meta = {
    ja: { title: 'About', description: '東京都在住のエンジニア Frank Ding について。' },
    zh: { title: '关于我', description: '关于 Frank Ding — 东京的工程师。' },
    en: { title: 'About', description: 'About Frank Ding — Engineer in Tokyo.' },
  }
  const t = meta[locale as keyof typeof meta] ?? meta.ja
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/about`,
    },
  }
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = aboutContent[locale as keyof typeof aboutContent]

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-reading px-6 pt-20 pb-16">
        {/* Header */}
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.title}</h1>
          <p className="text-xl text-[var(--muted)] font-serif">{t.intro}</p>
        </section>

        {/* Content */}
        <section className="py-12 space-y-8">
          <div>
            <p className="text-lg leading-relaxed">{t.description}</p>
          </div>

          <div className="border-l-2 border-[var(--accent)] pl-8 py-4">
            <p className="font-serif text-xl leading-relaxed italic text-[var(--muted)]">
              {t.philosophy}
            </p>
          </div>

          <div className="pt-8">
            <p className="text-sm text-[var(--muted)] font-mono">{t.contact}</p>
          </div>
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}