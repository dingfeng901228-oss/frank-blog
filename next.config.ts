import type { NextConfig } from 'next'
import {routing} from './src/i18n/routing'
import {defineRouting} from 'next-intl/routing'
import createMiddleware from 'next-intl/middleware'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}

export default nextConfig