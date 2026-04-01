import { describe, expect, it } from 'vitest'
import { getLocalImageUrl } from '../../../../components/common/site/helpers/ad'
import type { Ad } from '../../../../interfaces/site/ad.interface'

describe('components/common/site/helpers/ad (unit)', () => {
  const ad: Ad = {
    id: 1,
    image_zh: 'zh.webp',
    image_en: 'en.webp',
    image_ja: 'ja.webp',
    aspect: '6/1',
    link: 'https://example.com',
    exclude_locales: [],
  }

  it('returns locale image with fallback order', () => {
    expect(getLocalImageUrl('en', ad)).toBe('en.webp')
    expect(getLocalImageUrl('zh', ad)).toBe('zh.webp')
    expect(getLocalImageUrl('ja', ad)).toBe('ja.webp')
  })

  it('falls back when target locale image is null', () => {
    const noEn: Ad = { ...ad, image_en: null }
    expect(getLocalImageUrl('en', noEn)).toBe('ja.webp')

    const noJa: Ad = { ...ad, image_ja: null }
    expect(getLocalImageUrl('ja', noJa)).toBe('en.webp')
  })

  it('falls back to zh when all optional images are null', () => {
    const zhOnly: Ad = { ...ad, image_en: null, image_ja: null }
    expect(getLocalImageUrl('en', zhOnly)).toBe('zh.webp')
    expect(getLocalImageUrl('ja', zhOnly)).toBe('zh.webp')
  })
})
