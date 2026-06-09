'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/config'

/* ── 3-language nav labels ── */
const navLabels: Record<Locale, { label: string; href: string }[]> = {
  ja: [
    { label: 'ブログ', href: '/blog' },
    { label: 'ノート', href: '/notes' },
    { label: '概要', href: '/about' },
  ],
  zh: [
    { label: '博客', href: '/blog' },
    { label: '笔记', href: '/notes' },
    { label: '关于', href: '/about' },
  ],
  en: [
    { label: 'Blog', href: '/blog' },
    { label: 'Notes', href: '/notes' },
    { label: 'About', href: '/about' },
  ],
}

/* ── Logo subtitle ── */
const logoSub: Record<Locale, string> = {
  ja: '世界を探求する技術人',
  zh: '探索世界的技术人',
  en: 'Exploring the World with Tech',
}

/* ── Status tag ── */
const statusLabels: Record<Locale, string> = {
  ja: '東京',
  zh: 'Tokyo',
  en: 'Tokyo',
}

/* ── Locale display names ── */
const localeNames: Record<Locale, string> = {
  ja: '日本語',
  zh: '中文',
  en: 'English',
}

/* ── Locale short flags ── */
const localeShort: Record<Locale, string> = {
  ja: 'JP',
  zh: 'ZH',
  en: 'EN',
}

interface NavbarProps {
  locale: Locale
}

export default function Navbar({ locale }: NavbarProps) {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getLocalePath = (newLocale: Locale) => {
    const m = pathname.match(/^\/(ja|zh|en)(\/.*)?$/)
    if (!m) return `/${newLocale}/`
    const pathPart = m[2] || '/'
    return `/${newLocale}${pathPart}`
  }

  const links = navLabels[locale] ?? navLabels.ja
  const currentLangLabel = localeShort[locale]

  const isActiveLink = (href: string) => {
    if (href === '/') return pathname === `/${locale}` || pathname === `/${locale}/`
    return pathname.includes(href)
  }

  return (
    <header className="sticky top-0 z-50 w-full h-[72px]">
      {/* Glass background */}
      <div
        className="absolute inset-0 border-b"
        style={{
          background: 'rgba(8, 12, 32, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.06)',
        }}
      />

      <nav
        className="relative mx-auto flex h-full items-center justify-between"
        style={{
          paddingLeft: 'clamp(1.5rem, 4vw, 5rem)',
          paddingRight: 'clamp(1.5rem, 4vw, 5rem)',
          maxWidth: '1480px',
        }}
      >
        {/* ── Logo + subtitle ── */}
        <Link href={`/${locale}`} className="flex flex-col group flex-shrink-0">
          <span
            className="font-serif text-lg tracking-wide transition-colors text-white/92 group-hover:text-[var(--accent)]"
            style={{ fontWeight: 600 }}
          >
            Frank
          </span>
          <span
            className="text-xs leading-none mt-0.5"
            style={{ color: 'rgba(255, 255, 255, 0.55)', fontFamily: 'var(--font-mono)' }}
          >
            {logoSub[locale]}
          </span>
        </Link>

        {/* ── Desktop nav links ── */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((item) => {
            const active = isActiveLink(item.href)
            return (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className="text-sm transition-colors"
                style={{
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.72)',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = '#ffffff'
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 0.72)'
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* ── Right group: status + lang dropdown + mobile toggle ── */}
        <div className="flex items-center gap-3">
          {/* Status pill */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono"
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              color: 'rgba(147, 197, 253, 0.9)',
              letterSpacing: '0.03em',
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                style={{ background: '#3B82F6' }}
              />
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ background: '#3B82F6' }}
              />
            </span>
            {statusLabels[locale]}
          </div>

          {/* ── Language dropdown ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono tracking-wider rounded-md transition-all"
              style={{
                color: 'rgba(255, 255, 255, 0.8)',
                background: dropdownOpen ? 'rgba(255,255,255,0.05)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                if (!dropdownOpen) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span style={{ fontWeight: 500 }}>{currentLangLabel}</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown menu —— 只显示「可切换」语言，不显示当前语言 */}
            {dropdownOpen && (
              <div
                className="dropdown-enter absolute right-0 top-full mt-1.5 min-w-[140px] p-1.5 rounded-xl z-50"
                style={{
                  background: 'rgba(12, 16, 36, 0.92)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                }}
              >
                {(['ja', 'zh', 'en'] as Locale[])
                  .filter((loc) => loc !== locale)
                  .map((loc) => (
                    <Link
                      key={loc}
                      href={getLocalePath(loc)}
                      className="flex items-center px-3 text-sm rounded-lg transition-colors"
                      style={{
                        height: '44px',
                        color: 'rgba(255, 255, 255, 0.75)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                        background: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.06)'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                      }}
                      onClick={() => setDropdownOpen(false)}
                    >
                      {localeNames[loc]}
                    </Link>
                  ))}
              </div>
            )}
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            className="md:hidden flex flex-col gap-1 p-1"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle navigation"
          >
            <span className="block w-5 h-px" style={{ background: 'rgba(255,255,255,0.6)' }} />
            <span className="block w-5 h-px" style={{ background: 'rgba(255,255,255,0.6)' }} />
            <span className="block w-5 h-px" style={{ background: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>
      </nav>

      {/* ── Mobile nav panel ── */}
      {mobileNavOpen && (
        <div
          className="md:hidden absolute left-0 right-0 z-50 border-b"
          style={{
            background: 'rgba(8, 12, 32, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'rgba(255, 255, 255, 0.06)',
          }}
        >
          <div className="flex flex-col gap-1 px-6 py-6">
            {links.map((item) => {
              const active = isActiveLink(item.href)
              return (
                <Link
                  key={item.href}
                  href={`/${locale}${item.href}`}
                  className="px-4 py-3 rounded-lg text-sm transition-colors"
                  style={{
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.72)',
                    background: active ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  }}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              )
            })}
            {/* Mobile status */}
            <div className="flex items-center gap-1.5 px-4 py-3 mt-2 text-xs font-mono"
              style={{ color: 'rgba(147, 197, 253, 0.8)' }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#3B82F6' }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#3B82F6' }} />
              </span>
              {statusLabels[locale]}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
