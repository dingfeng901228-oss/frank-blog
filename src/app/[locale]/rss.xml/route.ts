import { getAllPosts, getAllLocales } from '@/lib/blog'
import { getAllNotes } from '@/lib/notes'
import type { Locale } from '@/i18n/config'

const BASE_URL = 'https://blog.frank2025.com'

const rssDescriptions = {
  ja: '技術は手段であり、思考こそが本質。学び続け、考え続け、技術を通して世界を探求する。',
  zh: '技术是工具，思考才是核心。持续学习，记录思考，用技术探索世界。',
  en: 'Technology is a tool. Thinking is the core. Keep learning, keep exploring, and understand the world through technology.',
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  const posts = getAllPosts(locale as Locale)
  const notes = getAllNotes(locale as Locale)

  // Merge and sort by publishedAt desc
  const allItems = [
    ...posts.map((p) => ({ ...p, kind: 'post' as const, href: `${locale}/blog/${p.slug}` })),
    ...notes.map((n) => ({ ...n, kind: 'note' as const, href: `${locale}/notes/${n.slug}` })),
  ].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  const description = rssDescriptions[locale as keyof typeof rssDescriptions] ?? rssDescriptions.ja

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Frank Ding - ${locale.toUpperCase()}</title>
    <link>${BASE_URL}/${locale}</link>
    <description>${description}</description>
    <language>${locale}</language>
    <lastBuildDate>${allItems.length > 0 ? new Date(allItems[0].publishedAt).toUTCString() : new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/${locale}/rss.xml" rel="self" type="application/rss+xml"/>
    ${allItems
      .slice(0, 20)
      .map(
        (item) => `
    <item>
      <title><![CDATA[${item.kind === 'note' ? '✏️ ' : ''}${item.title}]]></title>
      <link>${BASE_URL}/${item.href}</link>
      <description><![CDATA[${item.description ?? ''}]]></description>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
      <guid isPermaLink="true">${BASE_URL}/${item.href}</guid>
      <category>${item.kind === 'post' ? 'Blog' : 'Note'}</category>
      ${item.tags?.map((tag) => `<category>${tag}</category>`).join('\n      ') ?? ''}
    </item>`
      )
      .join('')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}

export async function generateStaticParams() {
  return getAllLocales().map((locale) => ({ locale }))
}
