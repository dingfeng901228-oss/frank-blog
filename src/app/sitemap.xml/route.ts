import { getAllPosts } from '@/lib/blog'
import { getAllNotes } from '@/lib/notes'
import type { Locale } from '@/i18n/config'

export const dynamic = 'force-static'

const BASE_URL = 'https://blog.frank2025.com'

export async function GET() {
  const locales: Locale[] = ['ja', 'zh', 'en']
  const now = new Date().toISOString()

  // Track latest lastmod per unique path across locales
  const lastmodByPath = new Map<string, string>()
  const recordLastmod = (path: string, lm: string) => {
    const cur = lastmodByPath.get(path)
    if (!cur || lm > cur) lastmodByPath.set(path, lm)
  }

  // Static pages — single canonical entry per path with full hreflang set
  const staticPages: { path: string; changefreq: string; priority: number }[] = [
    { path: '', changefreq: 'weekly', priority: 1.0 },
    { path: '/blog', changefreq: 'weekly', priority: 0.8 },
    { path: '/notes', changefreq: 'weekly', priority: 0.8 },
    { path: '/about', changefreq: 'monthly', priority: 0.5 },
  ]
  for (const p of staticPages) recordLastmod(p.path, now)

  // Collect unique slug paths (de-duped across locales), record latest lastmod
  const postPaths = new Set<string>()
  for (const locale of locales) {
    for (const post of getAllPosts(locale)) {
      const path = `/blog/${post.slug}`
      postPaths.add(path)
      recordLastmod(path, post.updatedAt ?? post.publishedAt)
    }
  }
  const notePaths = new Set<string>()
  for (const locale of locales) {
    for (const note of getAllNotes(locale)) {
      const path = `/notes/${note.slug}`
      notePaths.add(path)
      recordLastmod(path, note.publishedAt)
    }
  }

  // Build ordered unique path list (static → posts → notes → rss)
  const allPaths: { path: string; changefreq: string; priority: number }[] = [
    ...staticPages,
    ...[...postPaths].map((path) => ({ path, changefreq: 'monthly', priority: 0.9 })),
    ...[...notePaths].map((path) => ({ path, changefreq: 'monthly', priority: 0.7 })),
    { path: '/rss.xml', changefreq: 'weekly', priority: 0.3 },
  ]

  // Build sitemap with hreflang annotations on every entry
  const urls = allPaths
    .map(({ path, changefreq, priority }) => {
      const lastmod = lastmodByPath.get(path) ?? now
      const hreflangLinks = [
        ...locales.map(
          (loc) => `    <xhtml:link rel="alternate" hreflang="${loc}" href="${BASE_URL}/${loc}${path}"/>`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/ja${path}"/>`,
      ].join('\n')

      return `  <url>
    <loc>${BASE_URL}/ja${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${hreflangLinks}
  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
