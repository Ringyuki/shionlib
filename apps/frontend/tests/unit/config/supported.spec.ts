import { describe, expect, it } from 'vitest'
import { supportedLocales, supportedLocalesEnum } from '../../../config/i18n/supported'

describe('config/i18n/supported (unit)', () => {
  it('defines locales and enum mappings consistently', () => {
    expect(supportedLocales).toEqual(['en', 'zh', 'ja'])
    expect(supportedLocalesEnum.EN).toBe('en')
    expect(supportedLocalesEnum.ZH).toBe('zh')
    expect(supportedLocalesEnum.JA).toBe('ja')
  })
})
