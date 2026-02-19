import { getPreferredLang } from './user-language-preference-getter.helper'

describe('getPreferredLang', () => {
  it('falls back to en on empty header', () => {
    expect(getPreferredLang()).toBe('en')
    expect(getPreferredLang('')).toBe('en')
  })

  it('picks supported language by quality order', () => {
    const header = 'fr-FR;q=1.0, ja-JP;q=0.8, en-US;q=0.7'
    expect(getPreferredLang(header)).toBe('ja')
  })

  it('parses base language tag and wildcard fallback', () => {
    expect(getPreferredLang('zh-CN, en-US;q=0.5')).toBe('zh')
    expect(getPreferredLang('fr-FR;q=0.9, *;q=0.1')).toBe('en')
  })
})
