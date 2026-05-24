import { getRequestConfig } from 'next-intl/server'
import { locales, defaultLocale } from './config'

export default getRequestConfig({
  locales,
  defaultLocale,
  localePrefix: 'always',
})