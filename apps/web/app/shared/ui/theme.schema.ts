import * as v from 'valibot'
import { readCookie } from '~/shared/http/cookie'
import { themeCookie, themePreferences, type ThemePreference } from './theme'

const preference = v.picklist(themePreferences)

export function isThemePreference(value: unknown): value is ThemePreference {
  return v.is(preference, value)
}

export function themeFrom(cookieHeader: string): ThemePreference {
  const value = readCookie(cookieHeader, themeCookie)
  return isThemePreference(value) ? value : 'system'
}
