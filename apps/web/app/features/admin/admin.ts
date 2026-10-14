import type { Schema } from '~/shared/api/types'

export const adminRoot = '/zh/admin'

export const adminLocale = 'zh'

export const adminPaths = {
  overview: adminRoot,
  reports: `${adminRoot}/reports`,
  checks: `${adminRoot}/checks`,
  comments: `${adminRoot}/comments`,
  walkthroughs: `${adminRoot}/walkthroughs`,
  games: `${adminRoot}/games`,
  translators: `${adminRoot}/translators`,
  users: `${adminRoot}/users`,
  sponsors: `${adminRoot}/sponsors`,
  friendLinks: `${adminRoot}/friend-links`,
  catalog: `${adminRoot}/catalog`,
  ai: `${adminRoot}/ai`,
  open: `${adminRoot}/open-api`,
  settings: `${adminRoot}/settings`,
  user: (id: number) => `${adminRoot}/users/${id}`,
  report: (id: number) => `${adminRoot}/reports?id=${id}`,
  reportsBy: (userId: number) => `${adminRoot}/reports?status=ALL&reporter=${userId}`,
  reportsAgainst: (userId: number) => `${adminRoot}/reports?status=ALL&uploader=${userId}`,
  scanCase: (id: number) => `${adminRoot}/checks?case=${id}`,
  comment: (id: number) => `${adminRoot}/comments?id=${id}`,
  commentsBy: (userId: number) => `${adminRoot}/comments?status=ALL&author=${userId}`,
  keysOf: (userId: number) => `${adminRoot}/open-api?user=${userId}`,
  walkthrough: (id: number) => `${adminRoot}/walkthroughs?status=HELD&id=${id}`,
} as const

export function adminAddress(pathname: string, search: string): string | undefined {
  const [, locale, area, ...rest] = pathname.split('/')
  if (area !== 'admin' || locale === adminLocale) {
    return undefined
  }
  return [adminRoot, ...rest].join('/') + search
}

export type Pending = Schema<'AdminPendingDTO'>

export type NavKey =
  | 'overview'
  | 'reports'
  | 'checks'
  | 'comments'
  | 'walkthroughs'
  | 'games'
  | 'translators'
  | 'users'
  | 'sponsors'
  | 'friendLinks'
  | 'catalog'
  | 'ai'
  | 'open'
  | 'settings'

export type NavEntry = {
  key: NavKey
  to: string
  end: boolean
  count: number
  alert: boolean
}

export type NavGroup = {
  key: 'review' | 'manage' | 'system'
  entries: NavEntry[]
}

export type Navigation = {
  lead: NavEntry[]
  groups: NavGroup[]
}

function entry(key: NavKey, to: string, count = 0): NavEntry {
  return { key, to, end: key === 'overview', count, alert: false }
}

export function navigationOf(pending: Pending): Navigation {
  return {
    lead: [entry('overview', adminPaths.overview)],
    groups: [
      {
        key: 'review',
        entries: [
          entry('reports', adminPaths.reports, pending.reports),
          entry('checks', adminPaths.checks, pending.malware_cases + pending.stalled_files),
          entry('comments', adminPaths.comments, pending.comments),
          entry('walkthroughs', adminPaths.walkthroughs, pending.walkthroughs),
        ],
      },
      {
        key: 'manage',
        entries: [
          entry('games', adminPaths.games),
          entry('translators', adminPaths.translators),
          entry('users', adminPaths.users),
          entry('sponsors', adminPaths.sponsors),
          entry('friendLinks', adminPaths.friendLinks),
        ],
      },
      {
        key: 'system',
        entries: [
          entry('catalog', adminPaths.catalog),
          { ...entry('ai', adminPaths.ai), alert: pending.ai_alerts > 0 },
          entry('open', adminPaths.open),
          entry('settings', adminPaths.settings),
        ],
      },
    ],
  }
}

export type TitledGame = Pick<Schema<'MalwareGameDTO'>, 'title_zh' | 'title_jp' | 'title_en'>

export function titleOf(game: TitledGame): string {
  return [game.title_zh, game.title_jp, game.title_en].find(title => title !== '') ?? ''
}

export const pageSize = 20

export type Paging = {
  page: number
  pageSize: number
  total: number
}

export function searchSet(search: string, key: string, value: string | undefined): string {
  const next = new URLSearchParams(search)
  if (value === undefined) {
    next.delete(key)
  } else {
    next.set(key, value)
  }
  const text = next.toString()
  return text === '' ? '' : `?${text}`
}
