import type { MetadataRoute } from 'next'
import { shionlibSiteConfig } from '@/config/site/shionlib'

export default function robots(): MetadataRoute.Robots {
  const { canonical, robots } = shionlibSiteConfig

  return {
    rules: {
      userAgent: '*',
      allow: robots.index ? '/' : undefined,
      disallow: robots.index ? undefined : '/',
    },
    sitemap: `${canonical}/sitemap.xml`,
  }
}
