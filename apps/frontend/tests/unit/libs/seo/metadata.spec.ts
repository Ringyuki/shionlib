import { describe, expect, it, vi } from 'vitest'
import { buildPageMetadata, createGenerateMetadata } from '../../../../libs/seo/metadata'

describe('libs/seo/metadata (unit)', () => {
  it('builds metadata with locale alternates and encoded OG image URL', async () => {
    const metadata = await buildPageMetadata('en', {
      path: '/game',
      title: 'Game & Demo',
      description: 'desc text',
      og: {
        title: 'OG Title',
        description: 'OG Desc',
        image: 'https://img.example.com/test a.webp',
        aspect: '1:1',
      },
    })

    expect(metadata.alternates?.canonical).toBe('/en/game')
    expect(metadata.alternates?.languages).toMatchObject({
      en: '/en/game',
      zh: '/zh/game',
      ja: '/ja/game',
      'x-default': '/game',
    })

    const ogImage = String(metadata.openGraph?.images)
    expect(ogImage).toContain('/og?')
    expect(ogImage).toContain('l=en')
    expect(ogImage).toContain('t=OG%20Title')
    expect(ogImage).toContain('ar=1%3A1')
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
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
