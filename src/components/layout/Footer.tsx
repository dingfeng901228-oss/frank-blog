import Link from 'next/link'
import { Github, Rss, Mail } from 'lucide-react'
import type { Locale } from '@/i18n/config'

const footerLinks = {
  ja: {
    description: '静かに観察し、思索し、記録する。',
    github: 'GitHub',
    rss: 'RSS',
    email: 'メール',
    archive: 'アーカイブ',
    tags: 'タグ一覧',
    search: '検索',
    blog: 'ブログ',
    notes: 'ノート',
    about: '概要',
  },
  zh: {
    description: '安静地观察、思考、记录。',
    github: 'GitHub',
    rss: 'RSS',
    email: '邮箱',
    archive: '归档',
    tags: '标签索引',
    search: '搜索',
    blog: '博客',
    notes: '随笔',
    about: '关于',
  },
  en: {
    description: 'Quietly observing, thinking, and writing.',
    github: 'GitHub',
    rss: 'RSS',
    email: 'Email',
    archive: 'Archive',
    tags: 'Tags',
    search: 'Search',
    blog: 'Blog',
    notes: 'Notes',
    about: 'About',
  },
}

interface FooterProps {
  locale: Locale
}

export default function Footer({ locale }: FooterProps) {
  const t = footerLinks[locale]

  // The site-map links (item 9②): the tag index and the archive pages are
  // reachable from here, alongside the content sections.
  const siteMap: Array<{ label: string; href: string }> = [
    { label: t.blog, href: `/${locale}/blog` },
    { label: t.notes, href: `/${locale}/notes` },
    { label: t.tags, href: `/${locale}/tags` },
    { label: t.archive, href: `/${locale}/archive` },
    { label: t.search, href: `/${locale}/search` },
    { label: t.about, href: `/${locale}/about` },
  ]

  /*
   * Item 13: the margin above the footer was 8rem (128px) on top of the
   * page container's own bottom padding, which left a large empty band
   * above the footer on the homepage. A normal section gap.
   */
  return (
    <footer className="border-t border-[var(--border)] py-16 mt-16">
      <div className="mx-auto max-w-5xl px-6">
        {/* Site map */}
        <nav
          aria-label={t.archive}
          className="flex flex-wrap gap-x-7 gap-y-2 mb-10 pb-8"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {siteMap.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-mono transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Tagline */}
          <div className="space-y-3">
            <p className="font-serif text-lg">{t.description}</p>
            <p className="text-xs text-[var(--muted)] font-mono">© 2026 Frank Ding</p>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/dingfeng901228-oss"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              aria-label={t.github}
            >
              <Github size={20} />
            </a>
            <Link
              href={`/${locale}/rss.xml`}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              aria-label={t.rss}
            >
              <Rss size={20} />
            </Link>
            <a
              href="mailto:dingfeng901112@gmail.com"
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              aria-label={t.email}
            >
              <Mail size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}