'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import PersonalCard from './PersonalCard'

/* ── 3-language content ── */
const heroContent = {
  ja: {
    badge: 'パーソナル',
    title: '世界に対して、いつも好奇心を持ち続ける人',
    subtitle:
      '技術は手段であり、思考こそが本質。学び続け、考え続け、技術を通して世界を探求する。',
    values: [
      { emoji: '📚', label: '持続的な学習', en: 'Keep Learning' },
      { emoji: '💡', label: '自立的な思考', en: 'Think Independently' },
      { emoji: '⚡️', label: '技術探求', en: 'Explore with Tech' },
      { emoji: '✍️', label: '記録と共有', en: 'Write & Share' },
    ],
    cta1: 'ブログを見る',
    cta2: '制作物を見る',
  },
  zh: {
    badge: '个人简介',
    title: '对世界始终保持好奇的人',
    subtitle: '技术是工具，思考才是核心。持续学习，记录思考，用技术探索世界。',
    values: [
      { emoji: '📚', label: '持续学习', en: 'Keep Learning' },
      { emoji: '💡', label: '独立思考', en: 'Think Independently' },
      { emoji: '⚡️', label: '技术探索', en: 'Explore with Tech' },
      { emoji: '✍️', label: '记录与分享', en: 'Write & Share' },
    ],
    cta1: '阅读博客',
    cta2: '查看作品',
  },
  en: {
    badge: 'Personal',
    title: 'A Person Who Always Stays Curious About the World',
    subtitle:
      'Technology is a tool. Thinking is the core. Keep learning, keep exploring, and understand the world through technology.',
    values: [
      { emoji: '📚', label: 'Keep Learning', en: 'Keep Learning' },
      { emoji: '💡', label: 'Think Independently', en: 'Think Independently' },
      { emoji: '⚡️', label: 'Explore with Tech', en: 'Explore with Tech' },
      { emoji: '✍️', label: 'Write & Share', en: 'Write & Share' },
    ],
    cta1: 'Read Blog',
    cta2: 'View Projects',
  },
}

const CONTAINER = 'mx-auto max-w-5xl px-6'

/* ── Value card ── */
function ValueCard({
  emoji,
  label,
  en,
  index,
}: {
  emoji: string
  label: string
  en: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 + index * 0.1, duration: 0.5, ease: 'easeOut' }}
      className="hero-value-card group"
    >
      <span className="block text-lg mb-1.5">{emoji}</span>
      <span className="block text-sm font-medium text-white/90 leading-snug">
        {label}
      </span>
      <span className="block text-[10px] font-mono text-white/35 mt-1 tracking-wide">
        {en}
      </span>
    </motion.div>
  )
}

/* ── Main component ── */
export default function HeroSection({ locale }: { locale: string }) {
  // Type-safe lookup with fallback to English
  const t =
    heroContent[locale as keyof typeof heroContent] ?? heroContent.en

  return (
    <section className="relative py-14 md:py-20 overflow-hidden">
      {/* ── star particles (CSS-only) ── */}
      <div className="star-particles" aria-hidden="true">
        <div className="star-layer star-layer-1" />
        <div className="star-layer star-layer-2" />
        <div className="star-layer star-layer-3" />
      </div>

      {/* ── ambient glows ── */}
      <div className="hero-glow" />
      <div className="hero-accent-glow" />

      {/* ── horizon light at bottom ── */}
      <div className="hero-horizon-glow" />

      <div className={`${CONTAINER} relative z-10`}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12 items-start">
          {/* ======== LEFT COLUMN ======== */}
          <div className="min-w-0">
            {/* badge */}
            <div className="flex items-center gap-2 mb-6">
              <span
                className="h-px w-8"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, #3B82F6 100%)',
                }}
              />
              <span
                className="text-[10px] uppercase tracking-[0.18em] font-mono"
                style={{ color: '#3B82F6' }}
              >
                {t.badge}
              </span>
            </div>

            {/* ── main title ── */}
            <h1 className="hero-title" itemProp="name">
              {t.title}
            </h1>

            {/* ── subtitle ── */}
            <p className="hero-subtitle">{t.subtitle}</p>

            {/* ── values cards (4-column) ── */}
            <div className="hero-values-grid">
              {t.values.map((v, i) => (
                <ValueCard
                  key={v.label}
                  emoji={v.emoji}
                  label={v.label}
                  en={v.en}
                  index={i}
                />
              ))}
            </div>

            {/* ── CTA buttons ── */}
            <div className="hero-cta-row">
              <Link
                href={`/${locale}/blog`}
                className="hero-cta-primary group"
              >
                {t.cta1}
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href={`/${locale}/notes`}
                className="hero-cta-secondary group"
              >
                {t.cta2}
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>

          {/* ======== RIGHT COLUMN ======== */}
          <div className="min-w-0">
            <PersonalCard locale={locale} />
          </div>
        </div>
      </div>
    </section>
  )
}
