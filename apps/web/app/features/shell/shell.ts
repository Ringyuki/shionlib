import { locales, type Locale } from '~/shared/i18n/locale'

export type NavKey =
  'home' | 'games' | 'releases' | 'developers' | 'favorites' | 'uploads' | 'messages' | 'settings'

export type NavEntry = {
  key: NavKey
  to: string
  end: boolean
}

export type NavSection = {
  key: 'discover' | 'mine'
  entries: NavEntry[]
}

export type SidebarMode = 'expanded' | 'rail'

export const sidebarCookie = 'shionlib_sidebar'

const entry = (key: NavKey, to: string, end = false): NavEntry => ({ key, to, end })

export function sitePaths(locale: Locale) {
  return {
    home: `/${locale}`,
    upload: `/${locale}/upload`,
    profile: (userId: number) => `/${locale}/user/${userId}`,
    settings: `/${locale}/user/settings`,
  }
}

export function navSections(locale: Locale, viewerId: number | null): NavSection[] {
  const paths = sitePaths(locale)
  const discover: NavSection = {
    key: 'discover',
    entries: [
      entry('home', paths.home, true),
      entry('games', `/${locale}/game`),
      entry('releases', `/${locale}/release`),
      entry('developers', `/${locale}/developer`),
    ],
  }
  if (viewerId === null) {
    return [discover]
  }
  return [
    discover,
    {
      key: 'mine',
      entries: [
        entry('favorites', `${paths.profile(viewerId)}/favorites`),
        entry('uploads', `${paths.profile(viewerId)}/uploads`),
        entry('messages', `/${locale}/message`),
        entry('settings', paths.settings),
      ],
    },
  ]
}

export function switchLocale(pathname: string, locale: Locale): string {
  const [, first = '', ...rest] = pathname.split('/')
  const tail = locales.some(candidate => candidate === first) ? rest : [first, ...rest]
  return ['', locale, ...tail].join('/').replace(/\/$/, '') || `/${locale}`
}

export function sidebarModeFrom(cookieHeader: string): SidebarMode {
  const value = cookieHeader
    .split(';')
    .map(part => part.trim().split('='))
    .find(([name]) => name === sidebarCookie)?.[1]
  return value === 'rail' ? 'rail' : 'expanded'
}

export function sidebarCookieValue(mode: SidebarMode): string {
  return `${sidebarCookie}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`
}
