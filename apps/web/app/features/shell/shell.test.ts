import { describe, expect, it } from 'vitest'
import { alsoWithin, navSections, sidebarCookieValue, sitePaths } from './shell'

describe('navSections', () => {
  it('shows only discovery to guests', () => {
    expect(navSections('zh', null).map(section => section.key)).toEqual(['discover'])
  })

  it('adds the viewer library for signed-in users', () => {
    const mine = navSections('en', 7).find(section => section.key === 'mine')
    expect(mine?.entries.map(entry => entry.to)).toEqual([
      '/en/user/favorites',
      '/en/user/uploads',
      '/en/message',
      '/en/user/settings',
    ])
  })

  it('matches only the home entry exactly so game pages keep the library active', () => {
    const [discover] = navSections('zh', null)
    expect(discover?.entries.filter(entry => entry.end).map(entry => entry.key)).toEqual(['home'])
  })
})

describe('alsoWithin', () => {
  it('keeps the library active on the page of a resource, which has no address under it', () => {
    const games = navSections('zh', null)[0]?.entries.find(entry => entry.key === 'games')
    expect(games).toBeDefined()
    if (games === undefined) {
      return
    }
    expect(alsoWithin(games, '/zh/resource/12')).toBe(true)
    expect(alsoWithin(games, '/zh/resource/12/comments')).toBe(true)
    expect(alsoWithin(games, '/zh/resources')).toBe(false)
    expect(alsoWithin(games, '/zh/release')).toBe(false)
  })
})

describe('sitePaths', () => {
  it('builds locale-prefixed paths', () => {
    expect(sitePaths('ja').profile(3)).toBe('/ja/user/3')
    expect(sitePaths('zh').upload).toBe('/zh/upload')
  })
})

describe('sidebar mode cookie', () => {
  it('writes a year-long cookie', () => {
    expect(sidebarCookieValue('rail')).toBe(
      'shionlib_sidebar=rail; Path=/; Max-Age=31536000; SameSite=Lax',
    )
  })
})
