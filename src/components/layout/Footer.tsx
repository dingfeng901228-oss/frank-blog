import Link from 'next/link'
import { Github, Rss, Mail } from 'lucide-react'
import type { Locale } from '@/i18n/config'

const footerLinks = {
  ja: {
    description: '静かに観察し、思索し、記録する。',
    github: 'GitHub',
    rss: 'RSS',
    email: 'メール',
  },
  zh: {
    description: '安静地观察、思考、记录。',
    github: 'GitHub',
    rss: 'RSS',
    email: '邮箱',
  },
  en: {
    description: 'Quietly observing, thinking, and writing.',
    github: 'GitHub',
    rss: 'RSS',
    email: 'Email',
  },
}

interface FooterProps {
  locale: Locale
}

export default function Footer({ locale }: FooterProps) {
  const t = footerLinks[locale]

  return (
    <footer className="border-t border-[var(--border)] py-16 mt-32">
      <div className="mx-auto max-w-5xl px-6">
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
              href="mailto:frank@frank2025.com"
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