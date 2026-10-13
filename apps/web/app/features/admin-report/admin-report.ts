import { searchSet } from '~/features/admin'
import type { Schema } from '~/shared/api/types'

export type Report = Schema<'ReportListItemDTO'>

export type ReportDetail = Schema<'ReportDetailDTO'>

export type ReportFile = Schema<'ReportFileDTO'>

export type Policy = Schema<'ReportPolicyDTO'>

export type Uploader = Schema<'AdminUserDetailDTO'>

export type Opened = {
  detail: ReportDetail
  uploader: Uploader
  policy: Policy
}

export const statuses = ['PENDING', 'VALID', 'INVALID'] as const

export type Status = (typeof statuses)[number]

export const everyStatus = 'ALL'

export const statusFilters = [...statuses, everyStatus] as const

export type StatusFilter = (typeof statusFilters)[number]

export const reasons = [
  'MALWARE',
  'IRRELEVANT',
  'BROKEN_LINK',
  'MISLEADING_CONTENT',
  'OTHER',
] as const

export type Reason = (typeof reasons)[number]

export const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export type Level = (typeof levels)[number]

export const verdicts = ['VALID', 'INVALID'] as const

export type Verdict = (typeof verdicts)[number]

export type Filter = {
  status: StatusFilter
  reason: Reason | undefined
  reporter: number | undefined
  uploader: number | undefined
  page: number
  opened: number | undefined
}

export type Narrowing = Pick<Filter, 'status' | 'reason' | 'reporter' | 'uploader'>

export const defaultStatus: StatusFilter = 'PENDING'

export const openedKey = 'id'

export function searchOf(filter: Narrowing, opened?: number): string {
  const entries: [string, string | undefined][] = [
    ['status', filter.status === defaultStatus ? undefined : filter.status],
    ['reason', filter.reason],
    ['reporter', filter.reporter?.toString()],
    ['uploader', filter.uploader?.toString()],
    [openedKey, opened?.toString()],
  ]
  return entries.reduce((search, [key, value]) => searchSet(search, key, value), '')
}

export function searchWith(search: string, opened: number | undefined): string {
  return searchSet(search, openedKey, opened?.toString())
}

export function narrowed(filter: Narrowing): boolean {
  return (
    filter.status !== defaultStatus ||
    filter.reason !== undefined ||
    filter.reporter !== undefined ||
    filter.uploader !== undefined
  )
}

export function defaultLevel(policy: Policy, reason: string): Level {
  return (
    (policy.levels ?? []).find(rule => (rule.reasons ?? []).includes(reason))?.level ?? 'MEDIUM'
  )
}

export type Penalty = Schema<'ReportPenaltyDTO'>

export function penaltyOf(policy: Policy, level: Level): Penalty | undefined {
  return (policy.levels ?? []).find(rule => rule.level === level)?.penalty
}

const daySeconds = 24 * 60 * 60

export function freezeDays(policy: Policy): number {
  return Math.round(policy.violation_freeze_seconds / daySeconds)
}

export type FalseStep = Schema<'ReportFalseStepDTO'>

export type FalseOutlook = {
  count: number
  now: FalseStep | undefined
  later: FalseStep[]
}

export function falseOutlook(policy: Policy, count: number): FalseOutlook {
  const steps = [...(policy.false_report_steps ?? [])].sort((a, b) => a.count - b.count)
  return {
    count,
    now: steps.find(step => step.count === count),
    later: steps.filter(step => step.count > count),
  }
}

export const passedCheck = 1

export const heldForReview = 6

export type CheckNote = 'passed' | 'held' | 'pending' | 'failed'

export function checkNote(file: Pick<ReportFile, 'file_check_status'>): CheckNote {
  switch (file.file_check_status) {
    case passedCheck:
      return 'passed'
    case heldForReview:
      return 'held'
    case 0:
    case 7:
    case 8:
      return 'pending'
    default:
      return 'failed'
  }
}
