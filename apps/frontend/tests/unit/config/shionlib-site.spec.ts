import { afterEach, describe, expect, it, vi } from 'vitest'

const loadConfig = async (overrides?: Record<string, string | undefined>) => {
  vi.resetModules()

  const backup = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ROBOTS_INDEX: process.env.NEXT_PUBLIC_ROBOTS_INDEX,
    NEXT_PUBLIC_ROBOTS_FOLLOW: process.env.NEXT_PUBLIC_ROBOTS_FOLLOW,
  }

  process.env.NEXT_PUBLIC_SITE_URL = overrides?.NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_ROBOTS_INDEX = overrides?.NEXT_PUBLIC_ROBOTS_INDEX
  process.env.NEXT_PUBLIC_ROBOTS_FOLLOW = overrides?.NEXT_PUBLIC_ROBOTS_FOLLOW

  const mod = await import('../../../config/site/shionlib')

  process.env.NEXT_PUBLIC_SITE_URL = backup.NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_ROBOTS_INDEX = backup.NEXT_PUBLIC_ROBOTS_INDEX
  process.env.NEXT_PUBLIC_ROBOTS_FOLLOW = backup.NEXT_PUBLIC_ROBOTS_FOLLOW
  return mod
}

describe('config/site/shionlib (unit)', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('uses env values for canonical and robots flags', async () => {
    const { shionlibSiteConfig } = await loadConfig({
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
      NEXT_PUBLIC_ROBOTS_INDEX: 'true',
      NEXT_PUBLIC_ROBOTS_FOLLOW: 'false',
    })

    expect(shionlibSiteConfig.canonical).toBe('https://example.com')
    expect(shionlibSiteConfig.robots.index).toBe(true)
    expect(shionlibSiteConfig.robots.follow).toBe(false)
  })

  it('contains required navbar links with one external entry', async () => {
    const { navBarConfig } = await loadConfig()

    expect(navBarConfig.links.length).toBeGreaterThan(0)
    expect(navBarConfig.links.some(link => link.href === '/game')).toBe(true)
    expect(navBarConfig.links.some(link => link.href === '/docs')).toBe(true)
    expect(navBarConfig.links.some(link => link.external === true)).toBe(true)
  })
})
