import { getAllPosts } from '@/lib/blog'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/config'
import type { Metadata } from 'next'
import { PostCard } from '@/components/blog/PostCard'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params

  const meta = {
    ja: {
      title: 'ブログ一覧',
      description: 'Ding Feng のブログ記事一覧。テクノロジー、AI、思考、生活について。',
    },
    zh: {
      title: '博客文章',
      description: 'Ding Feng 的博客文章列表。关于技术、AI、思考和生活。',
    },
    en: {
      title: 'Blog Posts',
      description: 'Blog posts by Ding Feng. Thoughts on technology, AI, life in Japan, and quiet observations.',
    },
  }

  const t = meta[locale as keyof typeof meta] ?? meta.ja

  return {
    title: t.title,
    description: t.description,
    openGraph: {
      title: `${t.title} — Frank Ding`,
      description: t.description,
      url: `https://blog.frank2025.com/${locale}/blog`,
    },
    alternates: {
      canonical: `https://blog.frank2025.com/${locale}/blog`,
    },
  }
}

export default async function BlogPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  const posts = getAllPosts(locale as Locale)

  return (
    <div className="min-h-screen">
      <Navbar locale={locale as Locale} />

      <main className="mx-auto max-w-[1480px] px-6 lg:px-16 xl:px-20 pt-20 pb-16">
        {/* Header */}
        <section className="py-16 border-b border-[var(--border)]">
          <h1 className="font-serif text-4xl font-medium mb-4">
            {locale === 'ja' ? 'ブログ' : locale === 'zh' ? '博客' : 'Blog'}
          </h1>
          <p className="text-[var(--muted)]">
            {locale === 'ja'
              ? `${posts.length} 記事を収録`
              : locale === 'zh'
                ? `共 ${posts.length} 篇文章`
                : `${posts.length} posts`}
          </p>
        </section>

        {/* Posts list — same card style as the notes list */}
        <section className="py-10">
          {posts.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-20">
              {locale === 'ja' ? 'まだ記事がありません。' : locale === 'zh' ? '暂无内容。' : 'No posts yet.'}
            </p>
          ) : (
            <div className="space-y-0">
              {posts.map((post) => (
                <PostCard
                  key={post.slug}
                  locale={locale as Locale}
                  slug={post.slug}
                  title={post.title}
                  description={post.description}
                  publishedAt={post.publishedAt}
                  readingTime={post.readingTime}
                  tags={post.tags}
                  collection="posts"
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
