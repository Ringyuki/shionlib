import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import createMDX from '@next/mdx'
import { resolve } from 'node:path'

const withNextIntl = createNextIntlPlugin()
const withMDX = createMDX()

const normalizeBaseUrl = (url?: string) => (url ? url.replace(/\/+$/, '') : undefined)

const internalApiBaseUrl =
  normalizeBaseUrl(process.env.INTERNAL_API_BASE_URL) ||
  (process.env.INTERNAL_API_PORT
    ? normalizeBaseUrl(`http://localhost:${process.env.INTERNAL_API_PORT}`)
    : undefined)
if (!internalApiBaseUrl)
  throw new Error('Missing internal API target: set INTERNAL_API_BASE_URL or INTERNAL_API_PORT.')

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  turbopack: {
    root: resolve(process.cwd(), '../..'),
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 't.vndb.org',
      },
      {
        protocol: 'https',
        hostname: 'lain.bgm.tv',
      },
      {
        protocol: 'https',
        hostname: 'images.yurari.moe',
      },
      {
        protocol: 'https',
        hostname: 'shionlib.com',
      },
      {
        protocol: 'https',
        hostname: 'www.kungal.com',
      },
      {
        protocol: 'https',
        hostname: 'www.moyu.moe',
      },
      {
        protocol: 'https',
        hostname: 'image.moyu.moe',
      },
      {
        protocol: 'https',
        hostname: 'nysoure.com',
      },
      {
        protocol: 'https',
        hostname: 'www.uuznav.com',
      },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_HOST!,
      },
    ],
    contentDispositionType: 'inline',
  },
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: `${internalApiBaseUrl}/:path*`,
      },
      {
        source: '/:locale/:vn([crsvpo]\\d+)',
        destination: 'https://vndb.org/:vn',
      },
      {
        source: '/:locale/:vn([crsvpo]\\d+)/:rest*',
        destination: 'https://vndb.org/:vn/:rest*',
      },
      {
        source: '/:sitemap(sitemap.*)',
        destination: `${internalApiBaseUrl}/:sitemap`,
      },
    ]
  },
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // for Aria2 push
            key: 'Access-Control-Allow-Private-Network',
            value: 'true',
          },
        ],
      },
    ]
  },
  experimental: {
    proxyClientMaxBodySize: '50mb',
    proxyTimeout: 600_000, // 10 minutes
  },
}

export default withNextIntl(withMDX(nextConfig))
