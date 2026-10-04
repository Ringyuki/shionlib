export const themePreferences = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof themePreferences)[number]

export const themeCookie = 'shionlib_theme'

export const darkClass = 'dark'

export const darkQuery = '(prefers-color-scheme: dark)'

export function isThemePreference(value: unknown): value is ThemePreference {
  return themePreferences.some(preference => preference === value)
}

export function themeFrom(cookieHeader: string): ThemePreference {
  const value = cookieHeader
    .split(';')
    .map(part => part.trim().split('='))
    .find(([name]) => name === themeCookie)?.[1]
  return isThemePreference(value) ? value : 'system'
}

export function themeCookieValue(preference: ThemePreference): string {
  return `${themeCookie}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function systemThemeScript(): string {
  return `try{if(matchMedia(${JSON.stringify(darkQuery)}).matches)document.documentElement.classList.add(${JSON.stringify(darkClass)})}catch(e){}`
}
