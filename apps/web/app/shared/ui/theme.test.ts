import { describe, expect, it } from 'vitest'
import { systemThemeScript, themeCookieValue } from './theme'
import { themeFrom } from './theme.schema'

describe('theme preference', () => {
  it('reads the cookie and falls back to the system theme', () => {
    expect(themeFrom('a=1; shionlib_theme=dark')).toBe('dark')
    expect(themeFrom('shionlib_theme=purple')).toBe('system')
    expect(themeFrom('')).toBe('system')
  })

  it('remembers the preference for a year', () => {
    expect(themeCookieValue('light')).toBe(
      'shionlib_theme=light; Path=/; Max-Age=31536000; SameSite=Lax',
    )
  })

  it('marks the document dark before the first paint when the system asks for it', () => {
    expect(systemThemeScript()).toContain('prefers-color-scheme: dark')
    expect(systemThemeScript()).toContain('classList.add("dark")')
  })
})
