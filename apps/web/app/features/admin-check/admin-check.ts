import { searchSet } from '~/features/admin'
import type { Inspection } from '~/features/inspection'
import type { Schema } from '~/shared/api/types'

export type ScanCase = Schema<'MalwareCaseItemDTO'>

export type CaseDetail = Schema<'MalwareCaseDetailDTO'>

export type Stalled = Schema<'StalledCheckDTO'>

export type Uploader = Schema<'AdminUserDetailDTO'>

export type ReviewPolicy = Schema<'MalwarePolicyDTO'>

export type Opened = {
  detail: CaseDetail
  uploader: Uploader
  policy: ReviewPolicy
  inspection: Inspection | undefined
}

export const decisions = ['ALLOW', 'DELETE'] as const

export type Decision = (typeof decisions)[number]

export const outcomes = ['ADMIN_ALLOW', 'ADMIN_DELETE', 'TIMEOUT_AUTO_DELETE'] as const

export type Outcome = (typeof outcomes)[number]

export const pendingStatus = 'PENDING'

export type Filter = {
  outcome: Outcome | undefined
  page: number
  opened: number | undefined
}

export const openedKey = 'case'

export const outcomeKey = 'result'

export const waitingLimit = 50

export function searchWith(search: string, opened: number | undefined): string {
  return searchSet(search, openedKey, opened?.toString())
}

export function searchOf(outcome: Outcome | undefined): string {
  return searchSet('', outcomeKey, outcome)
}

export function flagged(
  inspections: readonly Inspection[],
  viruses: readonly string[],
): Inspection | undefined {
  return inspections.find(inspection =>
    (inspection.scan.detections ?? []).some(detection => viruses.includes(detection.signature)),
  )
}

const shownHash = 8

export function shortHash(hash: string): string {
  return hash.length <= shownHash * 2 + 1
    ? hash
    : `${hash.slice(0, shownHash)}…${hash.slice(-shownHash)}`
}

export function waiting(detail: Pick<CaseDetail, 'status'>): boolean {
  return detail.status === pendingStatus
}
