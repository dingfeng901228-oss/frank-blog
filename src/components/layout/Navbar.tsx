'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/config'
import { localeFlags } from '@/i18n/config'

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Notes', href: '/notes' },
  { label: 'Tags', href: '/tags' },
  { label: 'About', href: '/about' },
]

interface NavbarProps {
  locale: Locale
}

export default function Navbar({ locale }: NavbarProps) {
  const pathname = usePathname()

  const getLocalePath = (newLocale: Locale) => {
    const pathWithoutLocale = pathname.replace(/^\/(ja|zh|en)/, '')
    return `/${newLocale}${pathWithoutLocale || '/'}`
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]" />
      <nav className="relative mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        {/* Logo */}
        <Link href={`/${locale}`} className="font-serif text-lg tracking-wide hover:opacity-80 transition-opacity">
          Frank
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className={cn(
                'text-sm tracking-wide transition-opacity hover:opacity-100',
                pathname.includes(item.href)
                  ? 'opacity-100'
                  : 'opacity-70'
              )}
            >
              {item.label}
            </Link>
          ))}
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
                  ? 'bg-[var(--accent)] text-[var(--background)] font-medium'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/30'
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