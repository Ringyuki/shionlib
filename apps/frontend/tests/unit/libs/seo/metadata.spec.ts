import { describe, expect, it, vi } from 'vitest'
import { buildPageMetadata, createGenerateMetadata } from '../../../../libs/seo/metadata'

describe('libs/seo/metadata (unit)', () => {
  it('builds resource OG URL pointing to og-service', async () => {
    const metadata = await buildPageMetadata('en', {
      path: '/game/42',
      title: 'Some Game',
      description: 'A great game',
      og: { resourceType: 'game', id: '42' },
    })

    expect(metadata.alternates?.canonical).toBe('/en/game/42')
    expect(metadata.alternates?.languages).toMatchObject({
      en: '/en/game/42',
      zh: '/zh/game/42',
      ja: '/ja/game/42',
      'x-default': '/game/42',
    })

    const ogImage = String(metadata.openGraph?.images)
    expect(ogImage).toContain('/game/42')
    expect(ogImage).toContain('locale=en')
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
  })

  it('builds default OG URL for static pages when og is omitted', async () => {
    const metadata = await buildPageMetadata('ja', {
      path: '/game',
      title: 'Games',
    })

    const ogImage = String(metadata.openGraph?.images)
    expect(ogImage).toContain('/default')
    expect(ogImage).toContain('locale=ja')
  })

  it('falls back to default OG when og is omitted', async () => {
    const metadata = await buildPageMetadata('zh', {
      path: '/release',
      title: 'Releases',
    })

    const ogImage = String(metadata.openGraph?.images)
    expect(ogImage).toContain('/default')
    expect(ogImage).toContain('locale=zh')
  })

  it('createGenerateMetadata awaits params/searchParams and delegates to resolver', async () => {
    const resolve = vi.fn(async (args: { locale: string; slug: string; tab?: string }) => {
      return {
        path: `/docs/${args.slug}`,
        title: `Doc ${args.slug}`,
        description: args.tab,
        xDefaultPath: '/docs',
      }
    })

    const generateMetadata = createGenerateMetadata(resolve)

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'ja', slug: 'intro' }),
      searchParams: Promise.resolve({ tab: 'overview' }),
    })

    expect(resolve).toHaveBeenCalledWith({
      locale: 'ja',
      slug: 'intro',
      tab: 'overview',
    })
    expect(metadata.alternates?.canonical).toBe('/ja/docs/intro')
    expect(metadata.alternates?.languages?.['x-default']).toBe('/docs')
    expect(metadata.title).toBe('Doc intro')
  })
})
