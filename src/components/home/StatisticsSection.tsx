'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { FileText, FolderGit2, Briefcase, GraduationCap } from 'lucide-react'

interface StatItemProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  value: number
  suffix?: string
  label: string
  delay: number
  inView: boolean
  format?: 'number' | 'percent'
  decimals?: number
}

function StatItem({
  icon: Icon,
  value,
  suffix,
  label,
  delay,
  inView,
  format = 'number',
  decimals = 0,
}: StatItemProps) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    const duration = 1200
    const startTime = Date.now() + delay * 1000
    let raf = 0
    const tick = () => {
      const elapsed = Date.now() - startTime
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick)
        return
      }
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(value * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, delay])

  const formatted =
    format === 'percent' ? display.toFixed(decimals) : Math.floor(display).toLocaleString()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className="relative group"
    >
      <div
        className="relative overflow-hidden rounded-xl p-5 md:p-6 transition-colors duration-200"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.3) 50%, transparent 100%)',
          }}
        />

        <div className="flex items-center justify-between mb-3">
          <Icon className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          <span
            className="text-[9px] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}
          >
            {label}
          </span>
        </div>

        <div className="flex items-baseline gap-1">
          <span
            className="text-3xl md:text-4xl font-semibold tabular-nums"
            style={{
              fontFamily: 'var(--font-serif)',
              color: 'var(--foreground-strong)',
              letterSpacing: '-0.02em',
            }}
          >
            {formatted}
          </span>
          {suffix && (
            <span
              className="text-base md:text-lg"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}
            >
              {suffix}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function StatisticsSection({ locale }: { locale: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  const labels = {
    ja: {
      articles: '記事',
      projects: 'プロジェクト',
      years: '経験年数',
      jlpt: 'JLPT N2',
      years_suffix: '年',
      jlpt_suffix: '%',
    },
    zh: {
      articles: '文章',
      projects: '项目',
      years: '工作年限',
      jlpt: 'JLPT N2',
      years_suffix: '年',
      jlpt_suffix: '%',
    },
    en: {
      articles: 'Articles',
      projects: 'Projects',
      years: 'Years Exp.',
      jlpt: 'JLPT N2',
      years_suffix: 'yr',
      jlpt_suffix: '%',
    },
  }

  const t = labels[locale as keyof typeof labels] || labels.en

  const stats = [
    { icon: FileText, value: 24, label: t.articles, format: 'number' as const },
    { icon: FolderGit2, value: 3, label: t.projects, format: 'number' as const },
    {
      icon: Briefcase,
      value: 13,
      label: t.years,
      suffix: t.years_suffix,
      format: 'number' as const,
    },
    {
      icon: GraduationCap,
      value: 80,
      label: t.jlpt,
      suffix: t.jlpt_suffix,
      format: 'percent' as const,
      decimals: 0,
    },
  ]

  return (
    <section ref={ref} className="py-12 md:py-16 relative">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map((s, i) => (
          <StatItem
            key={s.label}
            icon={s.icon}
            value={s.value}
            suffix={(s as { suffix?: string }).suffix}
            label={s.label}
            delay={i * 0.08}
            inView={isInView}
            format={(s as { format?: 'number' | 'percent' }).format}
            decimals={(s as { decimals?: number }).decimals}
          />
        ))}
      </div>
    </section>
  )
}
