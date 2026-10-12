import type { Schema } from '~/shared/api/types'

export const adminRoot = '/zh/admin'

export const adminLocale = 'zh'

export const adminPaths = {
  overview: adminRoot,
  reports: `${adminRoot}/reports`,
  checks: `${adminRoot}/checks`,
  users: `${adminRoot}/users`,
  user: (id: number) => `${adminRoot}/users/${id}`,
  report: (id: number) => `${adminRoot}/reports?id=${id}`,
  reportsBy: (userId: number) => `${adminRoot}/reports?status=ALL&reporter=${userId}`,
  reportsAgainst: (userId: number) => `${adminRoot}/reports?status=ALL&uploader=${userId}`,
  scanCase: (id: number) => `${adminRoot}/checks?case=${id}`,
} as const

export function adminAddress(pathname: string, search: string): string | undefined {
  const [, locale, area, ...rest] = pathname.split('/')
  if (area !== 'admin' || locale === adminLocale) {
    return undefined
  }
  return [adminRoot, ...rest].join('/') + search
}

export type Pending = Schema<'AdminPendingDTO'>

export type NavKey = 'overview' | 'reports' | 'checks' | 'users'

export type NavEntry = {
  key: NavKey
  to: string
  end: boolean
  count: number
}

export type NavGroup = {
  key: 'review' | 'manage'
  entries: NavEntry[]
}

export type Navigation = {
  lead: NavEntry[]
  groups: NavGroup[]
}

export function navigationOf(pending: Pending): Navigation {
  return {
    lead: [{ key: 'overview', to: adminPaths.overview, end: true, count: 0 }],
    groups: [
      {
        key: 'review',
        entries: [
          { key: 'reports', to: adminPaths.reports, end: false, count: pending.reports },
          {
            key: 'checks',
            to: adminPaths.checks,
            end: false,
            count: pending.malware_cases + pending.stalled_files,
          },
        ],
      },
      {
        key: 'manage',
        entries: [{ key: 'users', to: adminPaths.users, end: false, count: 0 }],
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
