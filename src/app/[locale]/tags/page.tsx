import { getAllTags, getPostsByTag, getAllLocales } from '@/lib/blog'
import { formatDate } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import Link from 'next/link'

const topicColors: Record<string, string> = {
  Tech: 'text-cyan-400',
  AI: 'text-violet-400',
  Life: 'text-emerald-400',
  Japan: 'text-rose-400',
  Notes: 'text-amber-400',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
  const locales = getAllLocales()
  const params: { locale: string }[] = []

  for (const locale of locales) {
    params.push({ locale })
  }

  return params
}

export default async function TagsPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const tags = getAllTags(locale as Locale)

  const labels = {
    ja: { title: 'タグ', all: 'すべて' },
    zh: { title: '标签', all: '全部' },
    en: { title: 'Tags', all: 'All' },
  }
  const l = labels[locale as keyof typeof labels]

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{l.title}</h1>
        </section>

        <section className="py-8 border-b border-[var(--border)]">
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link
                key={t}
                href={`/${locale}/tags/${t}`}
                className={`text-xs font-mono px-3 py-1.5 border rounded-full transition-colors ${topicColors[t] || 'text-[var(--muted)]'} border-[var(--border)] hover:border-[var(--accent)]/30`}
              >
                {t}
              </Link>
            ))}
          </div>
        </section>

        <section className="py-8">
          <p className="text-[var(--muted)] py-20 text-center">
            {locale === 'ja' ? 'タグを選んでください' : locale === 'zh' ? '请选择标签' : 'Select a tag'}
          </p>
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}