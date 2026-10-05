import { describe, expect, it } from 'vitest'
import { readCookie } from './cookie'

describe('readCookie', () => {
  it('finds a cookie by name in a Cookie header', () => {
    expect(readCookie('a=1; shionlib_theme=dark', 'shionlib_theme')).toBe('dark')
    expect(readCookie('a=1', 'shionlib_theme')).toBeUndefined()
    expect(readCookie('', 'a')).toBeUndefined()
  })
})
