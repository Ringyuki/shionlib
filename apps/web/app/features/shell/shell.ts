import type { Locale } from '~/shared/i18n/locale'

export type NavKey =
  | 'home'
  | 'games'
  | 'releases'
  | 'developers'
  | 'translators'
  | 'activity'
  | 'docs'
  | 'favorites'
  | 'uploads'
  | 'messages'
  | 'settings'

export type NavEntry = {
  key: NavKey
  to: string
  end: boolean
  count: number
  also: readonly string[]
}

export type NavSection = {
  key: 'discover' | 'mine'
  entries: NavEntry[]
}

export type ShellArea<Content> = {
  title: Content
  navigation: (rail: boolean) => Content
}

export const sidebarModes = ['expanded', 'rail'] as const

export type SidebarMode = (typeof sidebarModes)[number]

export const sidebarCookie = 'shionlib_sidebar'

const entry = (
  key: NavKey,
  to: string,
  end = false,
  count = 0,
  also: readonly string[] = [],
): NavEntry => ({
  key,
  to,
  end,
  count,
  also,
})

export function alsoWithin(entry: Pick<NavEntry, 'also'>, pathname: string): boolean {
  return entry.also.some(place => pathname === place || pathname.startsWith(`${place}/`))
}

export function sitePaths(locale: Locale) {
  return {
    home: `/${locale}`,
    games: `/${locale}/game`,
    releases: `/${locale}/release`,
    upload: `/${locale}/upload`,
    uploads: `/${locale}/user/uploads`,
    favorites: `/${locale}/user/favorites`,
    uploading: `/${locale}/user/uploads?status=uploading`,
    profile: (userId: number) => `/${locale}/user/${userId}`,
    settings: `/${locale}/user/settings`,
    friendLinks: `/${locale}/friend-link`,
    sponsor: `/${locale}/sponsor`,
    messages: `/${locale}/message`,
  }
}

export const adminPath = '/zh/admin'

export const sitePath = '/'

export function navSections(locale: Locale, viewerId: number | null, unread = 0): NavSection[] {
  const paths = sitePaths(locale)
  const discover: NavSection = {
    key: 'discover',
    entries: [
      entry('home', paths.home, true),
      entry('games', paths.games, false, 0, [`/${locale}/resource`]),
      entry('releases', paths.releases),
      entry('developers', `/${locale}/developer`),
      entry('translators', `/${locale}/translator`),
      entry('activity', `/${locale}/activity`),
      entry('docs', `/${locale}/docs`),
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
        entry('favorites', paths.favorites),
        entry('uploads', paths.uploads),
        entry('messages', paths.messages, false, unread),
        entry('settings', paths.settings),
      ],
    },
  ]
}

export function sidebarCookieValue(mode: SidebarMode): string {
  return `${sidebarCookie}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export const repositoryUrl = 'https://github.com/Ringyuki/shionlib'

export const telegramUrl = 'https://t.me/shionlib'

export const contactEmail = 'admin@shionlib.com'
