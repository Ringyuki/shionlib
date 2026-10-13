import { describe, expect, it } from 'vitest'
import { friends, hostOf } from './friends'

describe('friends', () => {
  it('names a site by its host without the www', () => {
    expect(hostOf('https://www.kungal.com')).toBe('kungal.com')
    expect(hostOf('https://nysoure.com/')).toBe('nysoure.com')
  })

  it('lists every site once, with a secure address and a logo', () => {
    expect(new Set(friends.map(friend => friend.url)).size).toBe(friends.length)
    expect(friends.every(friend => friend.url.startsWith('https://'))).toBe(true)
    expect(friends.every(friend => friend.logo.startsWith('https://'))).toBe(true)
  })
})
