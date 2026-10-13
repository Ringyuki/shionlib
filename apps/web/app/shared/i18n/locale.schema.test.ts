import { describe, expect, it } from 'vitest'
import { chosenLocale, htmlLang, localizedLocation, switchLocale } from './locale.schema'

describe('chosenLocale', () => {
  it('takes the locale cookie', () => {
    expect(chosenLocale('a=1; shionlib_locale=ja')).toBe('ja')
  })

  it('falls back to Chinese whatever the browser asks for', () => {
    expect(chosenLocale('')).toBe('zh')
    expect(chosenLocale('shionlib_locale=de')).toBe('zh')
  })
})

describe('localizedLocation', () => {
  it('puts the chosen locale before a path that has none', () => {
    expect(localizedLocation('', new URL('https://shionlib.com/game/11210?tab=info'))).toBe(
      '/zh/game/11210?tab=info',
    )
  })

  it('follows the locale cookie', () => {
    expect(localizedLocation('shionlib_locale=en', new URL('https://shionlib.com/'))).toBe('/en')
  })
})

describe('htmlLang', () => {
  it('maps locales to BCP 47 tags', () => {
    expect(htmlLang('zh')).toBe('zh-CN')
    expect(htmlLang('unknown')).toBe('zh-CN')
  })
})

describe('switchLocale', () => {
  it('replaces the locale segment', () => {
    expect(switchLocale('/zh/game/1', 'ja')).toBe('/ja/game/1')
    expect(switchLocale('/zh', 'en')).toBe('/en')
  })

  it('adds a locale to paths without one', () => {
    expect(switchLocale('/', 'en')).toBe('/en')
  })
})
