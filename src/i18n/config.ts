export const locales = ['ja', 'zh', 'en'] as const
export const defaultLocale = 'ja' as const

export type Locale = (typeof locales)[number]

export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  zh: '中文',
  en: 'English',
}

export const localeFlags: Record<Locale, string> = {
  ja: 'JP',
  zh: 'ZH',
  en: 'EN',
}