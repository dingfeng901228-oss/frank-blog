import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import { getTagCounts } from '@/lib/archive'

interface PageProps {
  params: Promise<{ locale: string }>
}

const copy = {
  ja: {
    title: 'タグ一覧',
    description: 'すべての記事とノートに付いているタグの一覧です。',
    count: (n: number) => `${n} 件のタグ`,
    usage: (n: number) => `${n} 件`,
  },
  zh: {
    title: '标签索引',
    description: '所有文章和随笔的标签索引。',
    count: (n: number) => `共 ${n} 个标签`,
    usage: (n: number) => `${n} 篇`,
  },
  en: {
    title: 'Tags',
    description: 'Every tag used across the blog posts and notes.',
    count: (n: number) => `${n} tags`,
    usage: (n: number) => `${n}`,
  },
} as const

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = copy[locale as keyof typeof copy] ?? copy.ja
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/tags`,
    },
  }
}

export default async function TagsIndexPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const t = copy[locale as keyof typeof copy] ?? copy.ja
  const tags = getTagCounts(locale as Locale)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">{t.title}</h1>
          <p className="text-[var(--muted)]">{t.description}</p>
          <p className="text-[var(--muted)] text-sm mt-2 font-mono">{t.count(tags.length)}</p>
        </section>

        <section className="py-10">
          {tags.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-20">
              {locale === 'ja' ? 'タグがまだありません。' : locale === 'zh' ? '还没有标签。' : 'No tags yet.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {tags.map(({ tag, count }) => (
                <Link
                  key={tag}
                  href={`/${locale}/search?tag=${encodeURIComponent(tag)}`}
                  className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                    textDecoration: 'none',
                  }}
                >
                  <span className="font-mono group-hover:text-[var(--accent)] transition-colors">
                    {tag}
                  </span>
                  <span className="text-xs opacity-60 font-mono">{t.usage(count)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer locale={locale as Locale} />
    </div>
  )
}
