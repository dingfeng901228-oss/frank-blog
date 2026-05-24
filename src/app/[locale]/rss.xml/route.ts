import { getAllPosts, getAllLocales } from '@/lib/blog'
import type { Locale } from '@/i18n/config'

const BASE_URL = 'https://blog.frank2025.com'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  const posts = getAllPosts(locale as Locale)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Frank Ding - ${locale.toUpperCase()}</title>
    <link>${BASE_URL}/${locale}</link>
    <description>Thoughts, code, and quiet observations.</description>
    <language>${locale}-${locale.toUpperCase()}</language>
    <atom:link href="${BASE_URL}/${locale}/rss.xml" rel="self" type="application/rss+xml"/>
    ${posts
      .map(
        (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE_URL}/${locale}/blog/${post.slug}</link>
      <description><![CDATA[${post.description}]]></description>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <guid>${BASE_URL}/${locale}/blog/${post.slug}</guid>
      ${post.tags?.map((tag) => `<category>${tag}</category>`).join('\n      ') ?? ''}
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