import type { NextConfig } from 'next'
import withNextIntl from 'next-intl/plugin'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}

const withIntl = withNextIntl('./src/i18n/request.ts')
export default withIntl(nextConfig)