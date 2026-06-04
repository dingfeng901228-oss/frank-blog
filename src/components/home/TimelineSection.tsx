'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Briefcase, GraduationCap, Home, MapPin, Plane, Rocket, Star } from 'lucide-react'

// 8 entries: 1991 birth -> 2025-now Tokyo.
// Years go from earliest to latest, so the timeline reads top-to-bottom.
const timelineData = [
  {
    date: '1991',
    title: 'Born in Zaozhuang, Shandong',
    title_ja: '山東省枣庄市で生まれる',
    title_zh: '出生于山东省枣庄市',
    description: 'Born in Zaozhuang, Shandong Province, China.',
    description_ja: '中国山東省枣庄市で生まれる。',
    description_zh: '出生于中国山东省枣庄市。',
    type: 'milestone' as const,
  },
  {
    date: '1996',
    title: 'Moved to Weihai, Shandong with parents',
    title_ja: '馬強市に走り、山東省威海へ',
    title_zh: '随父母搬家至山东威海',
    description: 'Moved to Weihai, Shandong Province with my parents.',
    description_ja: '父母と一緒に山東省威海へ走る。',
    description_zh: '随父母搬家至山东省威海。',
    type: 'milestone' as const,
  },
  {
    date: '1996 - 2010',
    title: 'Primary, middle, and high school in Weihai',
    title_ja: '威海で小・中・高校生涯',
    title_zh: '在威海读小学、初中、高中',
    description: 'Grew up in Weihai. Fourteen years of school on the Shandong peninsula.',
    description_ja: '威海で成长。山東半島での14年の学生生涯。',
    description_zh: '在威海成长。山东半岛上的 14 年学生生活。',
    type: 'education' as const,
  },
  {
    date: '2010 - 2014',
    title: 'Studied CS in Beijing, then started working',
    title_ja: '北京でコンピューター科学を学ぶ、そして勤務につく',
    title_zh: '北京学习计算机科学并参与工作',
    description: 'Wrote my first programs in Beijing. Discovered systems thinking. Started working before graduation.',
    description_ja: '北京で初めてのプログラムを書く。システム思考に出会う。卒業前に勤務を始める。',
    description_zh: '在北京写下第一个程序。发现系统思维。毕业前开始参与工作。',
    type: 'education' as const,
  },
  {
    date: '2014 - 2015',
    title: 'Outsourced to Qingdao, Shandong',
    title_ja: '山東省青岛へ外派工作',
    title_zh: '外派到山东青岛工作',
    description: 'First job out of school: sent to Qingdao on a project assignment. Network admin, server deployment, technical support.',
    description_ja: '卒業後初の勤務。プロジェクトで青岛へ外派。ネットワーク管理、サーバー展開、技術サポート。',
    description_zh: '毕业后的第一份工作，外派到青岛项目。网络管理、服务器部署、技术支持。',
    type: 'work' as const,
  },
  {
    date: '2015 - 2017',
    title: 'Back to Beijing to work',
    title_ja: '再び北京へ戻り勤務',
    title_zh: '回到北京工作',
    description: 'Moved back to Beijing. Network engineering, server operations, automation scripts.',
    description_ja: '再び北京へ。ネットワークエンジニアリング、サーバー運用、自動化スクリプト。',
    description_zh: '重返北京。网络工程、服务器运维、自动化脚本。',
    type: 'work' as const,
  },
  {
    date: '2017 - 2025',
    title: 'Back to Weihai, Shandong to work',
    title_ja: '山東省威海へ戻り勤務',
    title_zh: '回到山东威海工作',
    description: 'Eight years building and operating IT infrastructure in Weihai. Data centers, networks, internal systems.',
    description_ja: '8年間、威海でITインフラを構築・運用。データセンター、ネットワーク、社内システム。',
    description_zh: '在威海跟 IT 基础设施打交道 8 年。数据中心、网络和内部系统。',
    type: 'work' as const,
  },
  {
    date: '2025 - Present',
    title: 'Tokyo, Japan - language school & job hunting',
    title_ja: '東京・言語学校留学中、探して勤務先を検索',
    title_zh: '东京 - 语言学校留学中，探索工作中',
    description: 'Studying Japanese in Tokyo. Job hunting for IT infrastructure / AI roles.',
    description_ja: '東京で日本語を学んでいます。ITインフラやAIポジションを検索中。',
    description_zh: '在东京学习日语。探索 IT 基础设施 / AI 领域工作机会。',
    type: 'work' as const,
  },
]

const iconMap = {
  work: Briefcase,
  education: GraduationCap,
  project: Rocket,
  milestone: Star,
}

// Extra icons not used directly in the map but kept for the JSX inline
// references; Home / MapPin / Plane used to call out location changes.
const _extraIcons = { Home, MapPin, Plane }

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
            ? '34年の走り。起点から現在まで。'
            : locale === 'zh'
            ? '从 1991 到今天的一路走来。'
            : 'From 1991 to today. 34 years on the road.'}
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
                transition={{ duration: 0.5, delay: index * 0.08 }}
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
