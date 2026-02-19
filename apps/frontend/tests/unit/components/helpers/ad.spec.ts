import { describe, expect, it } from 'vitest'
import { getLocalImageUrl } from '../../../../components/common/site/helpers/ad'

describe('components/common/site/helpers/ad (unit)', () => {
  const ad = {
    image_zh: 'zh.webp',
    image_en: 'en.webp',
    image_ja: 'ja.webp',
  } as any

  it('returns locale image with fallback order', () => {
    expect(getLocalImageUrl('en', ad)).toBe('en.webp')
    expect(getLocalImageUrl('zh', ad)).toBe('zh.webp')
    expect(getLocalImageUrl('ja', ad)).toBe('ja.webp')
  })

  it('falls back when target locale image is missing', () => {
    expect(getLocalImageUrl('en', { image_zh: 'zh.webp', image_ja: 'ja.webp' } as any)).toBe(
      'ja.webp',
    )
    expect(getLocalImageUrl('ja', { image_zh: 'zh.webp', image_en: 'en.webp' } as any)).toBe(
      'en.webp',
    )
  })
})
