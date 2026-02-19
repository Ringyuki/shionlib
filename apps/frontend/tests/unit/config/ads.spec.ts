import { describe, expect, it } from 'vitest'
import { ads } from '../../../config/site/ads'
import { supportedLocalesEnum } from '../../../config/i18n/supported'

describe('config/site/ads (unit)', () => {
  it('contains stable ad entries with locale exclusions', () => {
    expect(ads.length).toBeGreaterThan(0)
    const ids = ads.map(ad => ad.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const ad of ads) {
      expect(ad.image_zh).toContain('http')
      expect(ad.link).toContain('http')
      expect(ad.excludeLocales).toContain(supportedLocalesEnum.EN)
      expect(ad.excludeLocales).toContain(supportedLocalesEnum.JA)
    }
  })
})
