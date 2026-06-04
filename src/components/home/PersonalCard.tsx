'use client'

import { motion } from 'framer-motion'
import { Github, FileText, BookOpen, MapPin, Code2, Sparkles } from 'lucide-react'

const cardContent = {
  ja: {
    name: 'Ding Feng',
    role: 'IT Infrastructure Engineer',
    sub: 'AI Enthusiast',
    location: 'Tokyo, Japan',
    links: {
      github: 'GitHub',
      blog: 'AI Blog',
      resume: 'Personal Resume',
    },
    status: 'OPEN TO WORK',
    statusSub: 'Tokyo / Remote',
  },
  zh: {
    name: 'Ding Feng',
    role: 'IT 基础设施工程师',
    sub: 'AI 爱好者',
    location: 'Tokyo, Japan',
    links: {
      github: 'GitHub',
      blog: 'AI 博客',
      resume: '个人简历',
    },
    status: '可工作',
    statusSub: '东京 / 远程',
  },
  en: {
    name: 'Ding Feng',
    role: 'IT Infrastructure Engineer',
    sub: 'AI Enthusiast',
    location: 'Tokyo, Japan',
    links: {
      github: 'GitHub',
      blog: 'AI Blog',
      resume: 'Personal Resume',
    },
    status: 'OPEN TO WORK',
    statusSub: 'Tokyo / Remote',
  },
}

const linkHrefs = {
  github: 'https://github.com/dingfeng901228-oss',
  blog: 'https://frankbot.org',
  resume: 'https://frank2025.com',
}

export default function PersonalCard({ locale }: { locale: string }) {
  const t = cardContent[locale as keyof typeof cardContent] || cardContent.en

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
      className="relative w-full max-w-sm mx-auto"
    >
      <div
        className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.4) 50%, transparent 100%)',
          }}
        />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1.5">
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
            <span
              className="text-[10px] uppercase tracking-[0.12em]"
              style={{ fontFamily: 'var(--font-mono)', color: '#3B82F6' }}
            >
              {t.status}
            </span>
          </div>
          <span
            className="text-[10px] uppercase tracking-[0.08em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}
          >
            {t.statusSub}
          </span>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="relative flex-shrink-0">
            <div
              className="w-16 h-16 rounded-full overflow-hidden"
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow:
                  '0 0 0 1px rgba(59,130,246,0.15), 0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src="/avatar.jpg"
                alt="Ding Feng"
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--background)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Sparkles className="w-2.5 h-2.5" style={{ color: '#3B82F6' }} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--foreground-strong)' }}
            >
              {t.name}
            </h3>
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground)' }}
            >
              {t.role}
            </p>
            <p
              className="text-xs leading-relaxed"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}
            >
              {t.sub}
            </p>
          </div>
        </div>

        <div className="h-px w-full mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-3 h-3" style={{ color: 'var(--muted)' }} />
          <span
            className="text-[11px]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground)' }}
          >
            {t.location}
          </span>
          <span className="text-[11px] ml-auto" style={{ color: 'var(--muted)' }}>
            JST
          </span>
        </div>

        <div className="space-y-1.5">
          <CardLink
            icon={<Github className="w-3.5 h-3.5" />}
            label={t.links.github}
            href={linkHrefs.github}
          />
          <CardLink
            icon={<BookOpen className="w-3.5 h-3.5" />}
            label={t.links.blog}
            href={linkHrefs.blog}
          />
          <CardLink
            icon={<FileText className="w-3.5 h-3.5" />}
            label={t.links.resume}
            href={linkHrefs.resume}
          />
        </div>

        <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Code2 className="w-2.5 h-2.5" style={{ color: 'var(--muted)' }} />
            <span
              className="text-[9px] uppercase tracking-[0.12em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}
            >
              {locale === 'ja' ? '技術スタック' : locale === 'zh' ? '技术栈' : 'Stack'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {['TypeScript', 'Python', 'AI', 'Linux', 'Docker', 'Cloud'].map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[10px]"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--muted)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function CardLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode
  label: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors duration-150"
      style={{ background: 'transparent' }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <span
        style={{ color: 'var(--muted)' }}
        className="group-hover:!text-[#3B82F6] transition-colors"
      >
        {icon}
      </span>
      <span
        className="text-xs flex-1"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground)' }}
      >
        {label}
      </span>
      <span
        className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--muted)' }}
      >
        ↗
      </span>
    </a>
  )
}
