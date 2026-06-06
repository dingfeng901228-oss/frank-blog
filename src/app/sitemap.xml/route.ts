import { getAllPosts } from '@/lib/blog'
import { getAllNotes } from '@/lib/notes'
import type { Locale } from '@/i18n/config'

export const dynamic = 'force-static'

const BASE_URL = 'https://blog.frank2025.com'

export async function GET() {
  const locales: Locale[] = ['ja', 'zh', 'en']
  const now = new Date().toISOString()

  const urls: string[] = []

  for (const locale of locales) {
    // Homepage
    urls.push(`
  <url>
    <loc>${BASE_URL}/${locale}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`)

    // Blog index
    urls.push(`
  <url>
    <loc>${BASE_URL}/${locale}/blog</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)

    // Notes index
    urls.push(`
  <url>
    <loc>${BASE_URL}/${locale}/notes</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)

    // About
    urls.push(`
  <url>
    <loc>${BASE_URL}/${locale}/about</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`)

    // Blog posts
    const posts = getAllPosts(locale)
    for (const post of posts) {
      urls.push(`
  <url>
    <loc>${BASE_URL}/${locale}/blog/${post.slug}</loc>
    <lastmod>${post.updatedAt ?? post.publishedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`)
    }

    // Notes
    const notes = getAllNotes(locale)
    for (const note of notes) {
      urls.push(`
  <url>
    <loc>${BASE_URL}/${locale}/notes/${note.slug}</loc>
    <lastmod>${note.publishedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`)
    }

    // RSS feed
    urls.push(`
  <url>
    <loc>${BASE_URL}/${locale}/rss.xml</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.3</priority>
  </url>`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${urls.join('')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
