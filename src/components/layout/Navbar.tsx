'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/config'
import { localeFlags } from '@/i18n/config'

const navLabels: Record<Locale, { label: string; href: string }[]> = {
  ja: [
    { label: 'ホーム', href: '/' },
    { label: 'ブログ', href: '/blog' },
    { label: 'ノート', href: '/notes' },
    { label: '概要', href: '/about' },
  ],
  zh: [
    { label: '首页', href: '/' },
    { label: '博客', href: '/blog' },
    { label: '笔记', href: '/notes' },
    { label: '关于', href: '/about' },
  ],
  en: [
    { label: 'Home', href: '/' },
    { label: 'Blog', href: '/blog' },
    { label: 'Notes', href: '/notes' },
    { label: 'About', href: '/about' },
  ],
}

interface NavbarProps {
  locale: Locale
}

export default function Navbar({ locale }: NavbarProps) {
  const pathname = usePathname()

  const getLocalePath = (newLocale: Locale) => {
    const m = pathname.match(/^\/(ja|zh|en)(\/.*)?$/)
    if (!m) return `/${newLocale}/`
    const pathPart = m[2] || '/'
    // Blog post slugs are per-locale, so redirect to new locale's blog list
    if (pathPart.startsWith('/blog/')) return `/${newLocale}/blog`
    return `/${newLocale}${pathPart}`
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="absolute inset-0 backdrop-blur-xl border-b border-[var(--border)]" style={{ background: 'rgba(15, 20, 40, 0.7)' }} />
      <nav className="relative mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="font-serif text-lg tracking-wide transition-colors text-white/90 hover:text-[var(--accent)]"
        >
          Frank
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {(navLabels[locale] || navLabels.ja).map((item) => {
            const isActive = item.href === '/'
              ? pathname === `/${locale}` || pathname === `/${locale}/`
              : pathname.includes(item.href)
            return (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className="nav-link text-sm tracking-wide"
                data-active={isActive ? 'true' : 'false'}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Language Switcher - JP | EN | ZH */}
        <div className="flex items-center gap-1">
          {(['ja', 'en', 'zh'] as Locale[]).map((loc) => (
            <Link
              key={loc}
              href={getLocalePath(loc)}
              className={cn(
                'px-3 py-1.5 text-xs font-mono tracking-wider transition-all rounded-md',
                loc === locale
                  ? 'bg-[var(--accent)] text-white font-medium shadow-[0_0_20px_rgba(59,130,246,0.35)]'
                  : 'text-white/70 hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]'
              )}
            >
              {localeFlags[loc]}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}