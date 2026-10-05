import { describe, expect, it } from 'vitest'
import { htmlLang, negotiateLocale } from './locale.schema'

describe('negotiateLocale', () => {
  it('prefers the locale cookie', () => {
    expect(negotiateLocale('a=1; shionlib_locale=ja', 'en-US,en;q=0.9')).toBe('ja')
  })

  it('falls back to the highest weighted supported language', () => {
    expect(negotiateLocale('', 'fr;q=0.9, en-GB;q=0.8, ja;q=0.7')).toBe('en')
  })

  it('ignores unsupported cookies and languages', () => {
    expect(negotiateLocale('shionlib_locale=de', 'de-DE, fr')).toBe('zh')
  })
})

describe('htmlLang', () => {
  it('maps locales to BCP 47 tags', () => {
    expect(htmlLang('zh')).toBe('zh-CN')
    expect(htmlLang('unknown')).toBe('zh-CN')
  })
})

describe('negotiateLocale weights', () => {
  it('treats malformed weights as unwanted', () => {
    expect(negotiateLocale('', 'en;q=abc, ja;q=0.5')).toBe('ja')
  })
})
