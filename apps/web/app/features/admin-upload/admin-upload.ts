import { searchSet } from '~/features/admin'
import type { Schema } from '~/shared/api/types'

export type UploadItem = Schema<'AdminUploadItemDTO'>

export type UploadDetail = Schema<'AdminUploadDTO'>

export type UploadFailure = Schema<'AdminUploadFailureDTO'>

export type UploadStage = UploadItem['stage']

export type UploadKind = UploadItem['kind']

export const stages = [
  'uploading',
  'pending',
  'processing',
  'published',
  'composed',
  'rejected',
  'canceled',
  'expired',
  'not_started',
] as const satisfies readonly UploadStage[]

export const everyStage = 'all'

export const stageFilters = [everyStage, ...stages] as const

export type StageFilter = (typeof stageFilters)[number]

export type Opened = { kind: UploadKind; id: number }

export type Filter = {
  stage: StageFilter
  query: string
  user: number | undefined
  failed: boolean
  page: number
  opened: Opened | undefined
}

export type Narrowing = Omit<Filter, 'page' | 'opened'>

export const sessionKey = 'id'

export const attemptKey = 'attempt'

export const maxQueryLength = 100

export const queryDelay = 350

const keyOfKind: Readonly<Record<UploadKind, string>> = { session: sessionKey, attempt: attemptKey }

export function searchOf(filter: Narrowing): string {
  const entries: [string, string | undefined][] = [
    ['stage', filter.stage === everyStage ? undefined : filter.stage],
    ['q', filter.query === '' ? undefined : filter.query],
    ['user', filter.user?.toString()],
    ['failed', filter.failed ? '1' : undefined],
  ]
  return entries.reduce((search, [key, value]) => searchSet(search, key, value), '')
}

export function searchWith(search: string, opened: Opened | undefined): string {
  const cleared = searchSet(searchSet(search, sessionKey, undefined), attemptKey, undefined)
  return opened === undefined ? cleared : searchSet(cleared, keyOfKind[opened.kind], `${opened.id}`)
}

export function narrowed(filter: Narrowing): boolean {
  return (
    filter.stage !== everyStage || filter.query !== '' || filter.user !== undefined || filter.failed
  )
}

export function percentOf(item: Pick<UploadItem, 'received' | 'chunks'>): number {
  return item.chunks === 0 ? 0 : Math.floor((item.received * 100) / item.chunks)
}

export function terminable(item: Pick<UploadItem, 'stage'>): boolean {
  return item.stage === 'uploading' || item.stage === 'pending'
}

export function allReceivedUnsubmitted(detail: UploadDetail): boolean {
  return (
    (detail.stage === 'expired' || detail.stage === 'canceled') &&
    detail.chunks > 0 &&
    detail.received === detail.chunks &&
    detail.session?.submitted_at === null
  )
}

export const failureLogStart = '2026-10-14T00:00:00+08:00'

export function startedBeforeFailureLog(item: Pick<UploadItem, 'started'>): boolean {
  return Date.parse(item.started) < Date.parse(failureLogStart)
}

const shortHashLength = 12

export function shortHash(hash: string): string {
  return hash.length <= shortHashLength ? hash : `${hash.slice(0, shortHashLength)}…`
}

export function detached(item: Pick<UploadItem, 'stage' | 'file_stage'>): boolean {
  return item.stage === 'published' && item.file_stage === null
}

const browsers: readonly [RegExp, string][] = [
  [/Edg\/(\d+)/u, 'Edge'],
  [/OPR\/(\d+)/u, 'Opera'],
  [/Firefox\/(\d+)/u, 'Firefox'],
  [/Chrome\/(\d+)/u, 'Chrome'],
  [/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//u, 'Safari'],
]

const systems: readonly [RegExp, string][] = [
  [/Windows/u, 'Windows'],
  [/Android/u, 'Android'],
  [/iPhone|iPad/u, 'iOS'],
  [/Mac OS X/u, 'macOS'],
  [/Linux/u, 'Linux'],
]

export type Browser = { name: string; version: string; system: string | undefined }

export function browserOf(userAgent: string): Browser | undefined {
  for (const [pattern, name] of browsers) {
    const version = pattern.exec(userAgent)?.[1]
    if (version !== undefined) {
      return { name, version, system: systems.find(([system]) => system.test(userAgent))?.[1] }
    }
  }
  return undefined
}
