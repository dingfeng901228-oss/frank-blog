'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Briefcase, GraduationCap, Rocket, Star } from 'lucide-react'

const timelineData = [
  {
    date: '2025 - Present',
    title: 'Tokyo, Japan — Student & Engineer',
    title_ja: '東京 — 学生 & エンジニア',
    title_zh: '东京 — 学生 & 工程师',
    description: 'Studying in Tokyo. Building AI tools, OpenClaw, and shipping this blog.',
    description_ja: '東京で留学中。AIツール・OpenClaw・ブログを構築。',
    description_zh: '在东京留学。构建AI工具、OpenClaw 和本博客。',
    type: 'work' as const,
  },
  {
    date: '2017 - 2025',
    title: 'IT Infrastructure Engineer — Weihai',
    title_ja: 'ITインフラエンジニア — 山東威海',
    title_zh: 'IT 基础设施工程师 — 山东威海',
    description: 'Eight years building and operating IT infrastructure. Data centers, networks, and internal systems.',
    description_ja: '8年間ITインフラを構築・運用。データセンター、ネットワーク、社内システム。',
    description_zh: '8年IT基础设施搭建与运维。数据中心、网络和内部系统。',
    type: 'work' as const,
  },
  {
    date: '2015 - 2017',
    title: 'IT Engineer — Beijing',
    title_ja: 'ITエンジニア — 北京',
    title_zh: 'IT 工程师 — 北京',
    description: 'Worked in Beijing. Network engineering, server operations, automation scripts.',
    description_ja: '北京で勤務。ネットワーク、サーバー運用、自動化スクリプト。',
    description_zh: '在北京工作。网络工程、服务器运维、自动化脚本。',
    type: 'work' as const,
  },
  {
    date: '2014 - 2015',
    title: 'IT Engineer — Qingdao',
    title_ja: 'ITエンジニア — 山東青岛',
    title_zh: 'IT 工程师 — 山东青岛',
    description: 'First job out of school. Network administration, server deployment, technical support.',
    description_ja: '卒業後の初仕事。ネットワーク管理、サーバー展開、技術サポート。',
    description_zh: '毕业后第一份工作。网络管理、服务器部署、技术支持。',
    type: 'work' as const,
  },
  {
    date: '2010 - 2014',
    title: 'Studied in Beijing',
    title_ja: '北京で学ぶ',
    title_zh: '北京求学',
    description: 'Studied computer science in Beijing. Wrote first programs, discovered systems thinking.',
    description_ja: '北京で情報科学を勉強。初めてのプログラムを書き、システム思考に出会う。',
    description_zh: '在北京学习计算机科学。写下第一个程序，发现系统思维。',
    type: 'education' as const,
  },
]

const iconMap = {
  work: Briefcase,
  education: GraduationCap,
  project: Rocket,
  milestone: Star,
}

const colorMap = {
  work: 'from-blue-500 to-cyan-500',
  education: 'from-purple-500 to-pink-500',
  project: 'from-orange-500 to-red-500',
  milestone: 'from-green-500 to-emerald-500',
}

export default function TimelineSection({ locale }: { locale: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const getTitle = (item: (typeof timelineData)[0]) => {
    if (locale === 'ja') return item.title_ja
    if (locale === 'zh') return item.title_zh
    return item.title
  }

  const getDesc = (item: (typeof timelineData)[0]) => {
    if (locale === 'ja') return item.description_ja
    if (locale === 'zh') return item.description_zh
    return item.description
  }

  return (
    <section ref={ref} className="py-20 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h2
          className="text-2xl md:text-3xl font-semibold mb-3"
          style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--foreground-strong)',
          }}
        >
          {locale === 'ja' ? '足跡' : locale === 'zh' ? '时间线' : 'Timeline'}
        </h2>
        <p
          className="text-sm md:text-base max-w-2xl mx-auto"
          style={{ color: 'var(--muted)' }}
        >
          {locale === 'ja'
            ? 'これまでの遍歴。こんなことやってきました。'
            : locale === 'zh'
            ? '我的技术成长之路。每一个里程碑。'
            : 'My journey in tech. Every milestone.'}
        </p>
      </motion.div>

      <div className="relative max-w-3xl mx-auto">
        <div
          className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px md:-translate-x-1/2"
          style={{ background: 'var(--border)' }}
        />

        <div className="space-y-10">
          {timelineData.map((item, index) => {
            const Icon = iconMap[item.type]
            const isLeft = index % 2 === 0

            return (
              <motion.div
                key={item.date + item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative pl-8 md:pl-0"
              >
                <div
                  className="absolute left-0 md:left-1/2 top-0 w-9 h-9 rounded-full flex items-center justify-center md:-translate-x-1/2 z-10"
                  style={{
                    background: 'var(--background-2)',
                    border: '2px solid var(--border-strong)',
                  }}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-gradient-to-br ${colorMap[item.type]} flex items-center justify-center`}
                  >
                    <Icon className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>

                <div
                  className={`md:w-[calc(50%-2rem)] ${
                    isLeft ? 'md:mr-auto md:pr-8' : 'md:ml-auto md:pl-8'
                  }`}
                >
                  <div
                    className="p-5 rounded-xl transition-colors duration-300"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span
                      className="text-xs font-medium mb-1 block"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent)',
                      }}
                    >
                      {item.date}
                    </span>
                    <h3
                      className="text-base font-semibold mb-1"
                      style={{ color: 'var(--foreground-strong)' }}
                    >
                      {getTitle(item)}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--muted)' }}
                    >
                      {getDesc(item)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
