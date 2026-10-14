import { describe, expect, it } from 'vitest'
import { hostOf } from './friends'

describe('friends', () => {
  it('names a site by its host without the www', () => {
    expect(hostOf('https://www.kungal.com')).toBe('kungal.com')
    expect(hostOf('https://nysoure.com/')).toBe('nysoure.com')
  })
})
