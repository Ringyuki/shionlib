import { searchSet } from '~/features/admin'
import type { Schema } from '~/shared/api/types'

export type UserItem = Schema<'AdminUserItemDTO'>

export type UserDetail = Schema<'AdminUserDetailDTO'>

export type Session = Schema<'AdminUserSessionDTO'>

export type Ladder = Schema<'UploadLadderDTO'>

export type Ban = Schema<'AdminUserBanDTO'>

export type Records = {
  reportsFiled: number
  reportsAgainst: number
  heldFiles: number
}

export type Opened = {
  detail: UserDetail
  sessions: Session[]
  liveSessions: number
  ladder: Ladder
  records: Records
}

export const roles = [1, 2, 3] as const

export type Role = (typeof roles)[number]

export const superAdmin: Role = 3

export const statuses = [1, 2] as const

export type Status = (typeof statuses)[number]

export const bannedStatus: Status = 2

export const sorts = ['last_login_at', 'created', 'id', 'name'] as const

export type Sort = (typeof sorts)[number]

export const defaultSort: Sort = 'last_login_at'

export const contentLimits = [1, 2, 3] as const

export type ContentLimit = (typeof contentLimits)[number]

export const languages = ['zh', 'en', 'ja'] as const

export type Language = (typeof languages)[number]

export type Filter = {
  query: string
  role: Role | undefined
  status: Status | undefined
  sort: Sort
  page: number
}

export const maxQueryLength = 100

export const queryDelay = 350

export function searchOf(filter: Omit<Filter, 'page'>): string {
  const entries: [string, string | undefined][] = [
    ['q', filter.query === '' ? undefined : filter.query],
    ['role', filter.role?.toString()],
    ['status', filter.status?.toString()],
    ['sort', filter.sort === defaultSort ? undefined : filter.sort],
  ]
  return entries.reduce((search, [key, value]) => searchSet(search, key, value), '')
}

export function narrowed(filter: Omit<Filter, 'page' | 'sort'>): boolean {
  return filter.query !== '' || filter.role !== undefined || filter.status !== undefined
}

export function ascending(sort: Sort): boolean {
  return sort === 'name'
}

type Someone = { id: number; role: number }

export function banned(user: Pick<UserDetail, 'status'>): boolean {
  return user.status === bannedStatus
}

export function canManage(viewer: Someone, target: Someone): boolean {
  return viewer.id === target.id || viewer.role >= superAdmin || viewer.role > target.role
}

export function canPunish(viewer: Someone, target: Someone): boolean {
  return viewer.id !== target.id && canManage(viewer, target)
}

export function canChangeRole(viewer: Someone, target: Someone): boolean {
  return viewer.id !== target.id && viewer.role >= superAdmin
}

export type TierStep = NonNullable<Ladder['tiers']>[number]

export function tierStep(ladder: Ladder, tier: TierStep['tier']): TierStep | undefined {
  return (ladder.tiers ?? []).find(step => step.tier === tier)
}

export function nextStep(
  ladder: Ladder,
  upload: Pick<UserDetail['upload'], 'approved' | 'trusted' | 'tier'>,
): TierStep | undefined {
  if (upload.trusted || upload.tier === 'admin') {
    return undefined
  }
  return (ladder.tiers ?? [])
    .filter(step => step.after > upload.approved)
    .toSorted((a, b) => a.after - b.after)[0]
}

export const banLengths = [3, 7, 30] as const

export const permanent = 'permanent'

export const custom = 'custom'

export const banChoices = [...banLengths, permanent, custom] as const

export type BanChoice = (typeof banChoices)[number]

const dayMilliseconds = 24 * 60 * 60 * 1000

export function banEnd(ban: Pick<Ban, 'banned_at' | 'banned_duration_days' | 'is_permanent'>) {
  if (ban.is_permanent || ban.banned_duration_days === null) {
    return undefined
  }
  return new Date(new Date(ban.banned_at).getTime() + ban.banned_duration_days * dayMilliseconds)
}

export const sessionsShown = 20
