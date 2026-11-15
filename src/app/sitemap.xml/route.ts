import { getAllPosts, getAllTags } from '@/lib/blog'
import { getAllNotes, getAllNoteTags } from '@/lib/notes'
import { tagSegment } from '@/lib/tags'
import type { Locale } from '@/i18n/config'

export const dynamic = 'force-static'

const BASE_URL = 'https://blog.frank2025.com'
const LOCALES: Locale[] = ['ja', 'zh', 'en']

/**
 * The sitemap lists every indexable page the build actually produces.
 *
 * The previous version emitted ONE `<loc>` per path -- always the Japanese
 * URL -- and pointed the other two languages at through `hreflang`
 * alternates. Search Console counts `<loc>` entries, so a site with ~390
 * indexable URLs was reported as 27. The 78 article pages alone were
 * unlisted.
 *
 * The three locales are separate pages with separate URLs, so each one
 * gets its own `<loc>`. The `hreflang` block is kept as well, to tell the
 * search engines that the three are translations of one another.
 *
 * Every path comes from the same content helpers that
 * `generateStaticParams` uses, so a URL that is listed here is a URL the
 * build writes a page for.
 */
export async function GET() {
  const now = new Date().toISOString()

  const url = (locale: string, path: string) => `${BASE_URL}/${locale}${path}`

  type Entry = {
    path: string
    changefreq: string
    priority: number
    lastmod: string
    /** Locales that actually have a page for this path. */
    locales: Locale[]
  }

  const entries = new Map<string, Entry>()

  const add = (
    path: string,
    opts: {
      changefreq: string
      priority: number
      lastmod?: string
      locales: Locale[]
    }
  ) => {
    const prev = entries.get(path)
    const lastmod = opts.lastmod ?? now
    entries.set(path, {
      path,
      changefreq: opts.changefreq,
      priority: opts.priority,
      lastmod: prev && prev.lastmod > lastmod ? prev.lastmod : lastmod,
      locales: opts.locales,
    })
  }

  // -- Static pages ---------------------------------------------------
  // Present in all three locales.
  const allLocales = [...LOCALES]
  add('', { changefreq: 'weekly', priority: 1.0, locales: allLocales })
  add('/blog', { changefreq: 'weekly', priority: 0.8, locales: allLocales })
  add('/notes', { changefreq: 'weekly', priority: 0.8, locales: allLocales })
  add('/about', { changefreq: 'monthly', priority: 0.5, locales: allLocales })

  // -- Articles -------------------------------------------------------
  // A post may not exist in every locale (a translation can be missing),
  // so the locale list is derived per slug rather than assumed.
  const postLocales = new Map<string, { locales: Locale[]; lastmod: string }>()
  for (const locale of LOCALES) {
    for (const post of getAllPosts(locale)) {
      const prev = postLocales.get(post.slug)
      const lm = post.updatedAt ?? post.publishedAt
      if (prev) {
        if (!prev.locales.includes(locale)) prev.locales.push(locale)
        if (lm > prev.lastmod) prev.lastmod = lm
      } else {
        postLocales.set(post.slug, { locales: [locale], lastmod: lm })
      }
    }
  }
  for (const [slug, { locales, lastmod }] of postLocales) {
    add(`/blog/${slug}`, { changefreq: 'monthly', priority: 0.9, lastmod, locales })
  }

  // -- Notes ----------------------------------------------------------
  const noteLocales = new Map<string, { locales: Locale[]; lastmod: string }>()
  for (const locale of LOCALES) {
    for (const note of getAllNotes(locale)) {
      const prev = noteLocales.get(note.slug)
      const lm = note.publishedAt
      if (prev) {
        if (!prev.locales.includes(locale)) prev.locales.push(locale)
        if (lm > prev.lastmod) prev.lastmod = lm
      } else {
        noteLocales.set(note.slug, { locales: [locale], lastmod: lm })
      }
    }
  }
  for (const [slug, { locales, lastmod }] of noteLocales) {
    add(`/notes/${slug}`, { changefreq: 'monthly', priority: 0.7, lastmod, locales })
  }

  // -- Tag pages ------------------------------------------------------
  // A tag page only exists in the locales that actually use that tag, and
  // `tagSegment` is the same encoder the links use, so every listed tag
  // URL is a page the build writes. Tags whose page would 404 are never
  // listed.
  const blogTags = new Map<string, { locales: Locale[] }>()
  for (const locale of LOCALES) {
    for (const tag of getAllTags(locale)) {
      const prev = blogTags.get(tag)
      if (prev) {
        if (!prev.locales.includes(locale)) prev.locales.push(locale)
      } else {
        blogTags.set(tag, { locales: [locale] })
      }
    }
  }
  for (const [tag, { locales }] of blogTags) {
    add(`/blog/tag/${tagSegment(tag)}`, {
      changefreq: 'weekly',
      priority: 0.4,
      locales,
    })
  }

  const noteTags = new Map<string, { locales: Locale[] }>()
  for (const locale of LOCALES) {
    for (const tag of getAllNoteTags(locale)) {
      const prev = noteTags.get(tag)
      if (prev) {
        if (!prev.locales.includes(locale)) prev.locales.push(locale)
      } else {
        noteTags.set(tag, { locales: [locale] })
      }
    }
  }
  for (const [tag, { locales }] of noteTags) {
    add(`/notes/tag/${tagSegment(tag)}`, {
      changefreq: 'weekly',
      priority: 0.4,
      locales,
    })
  }

  // -- Render ---------------------------------------------------------
  // `/rss.xml` is NOT listed: public/robots.txt has "Disallow: /rss.xml",
  // and the brief says blocked URLs must stay out of the sitemap.
  const urls: string[] = []
  for (const entry of entries.values()) {
    const hreflangLinks = [
      ...entry.locales.map(
        (loc) => `    <xhtml:link rel="alternate" hreflang="${loc}" href="${url(loc, entry.path)}"/>`
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${url('ja', entry.path)}"/>`,
    ].join('\n')

    for (const loc of entry.locales) {
      urls.push(`  <url>
    <loc>${url(loc, entry.path)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
${hreflangLinks}
  </url>`)
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
