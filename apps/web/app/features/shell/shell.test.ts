import { describe, expect, it } from 'vitest'
import { navSections, sidebarCookieValue, sitePaths, switchLocale } from './shell'

describe('navSections', () => {
  it('shows only discovery to guests', () => {
    expect(navSections('zh', null).map(section => section.key)).toEqual(['discover'])
  })

  it('adds the viewer library for signed-in users', () => {
    const mine = navSections('en', 7).find(section => section.key === 'mine')
    expect(mine?.entries.map(entry => entry.to)).toEqual([
      '/en/user/7/favorites',
      '/en/user/7/uploads',
      '/en/message',
      '/en/user/settings',
    ])
  })

  it('matches only the home entry exactly so game pages keep the library active', () => {
    const [discover] = navSections('zh', null)
    expect(discover?.entries.filter(entry => entry.end).map(entry => entry.key)).toEqual(['home'])
  })
})

describe('sitePaths', () => {
  it('builds locale-prefixed paths', () => {
    expect(sitePaths('ja').profile(3)).toBe('/ja/user/3')
    expect(sitePaths('zh').upload).toBe('/zh/upload')
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

describe('sidebar mode cookie', () => {
  it('writes a year-long cookie', () => {
    expect(sidebarCookieValue('rail')).toBe(
      'shionlib_sidebar=rail; Path=/; Max-Age=31536000; SameSite=Lax',
    )
  })
})
