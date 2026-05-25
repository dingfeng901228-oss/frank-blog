import {defineRouting} from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ja', 'zh', 'en'],
  defaultLocale: 'ja',
  localePrefix: 'always',
})