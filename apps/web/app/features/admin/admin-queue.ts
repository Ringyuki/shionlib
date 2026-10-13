import type { Schema } from '~/shared/api/types'
import { adminPaths, type Pending } from './admin'

export type QueueKind = 'malware' | 'stalled' | 'report' | 'comment' | 'walkthrough'

export const queueKinds = [
  'malware',
  'stalled',
  'report',
  'comment',
  'walkthrough',
] as const satisfies readonly QueueKind[]

export type ScanCase = Schema<'MalwareCaseItemDTO'>

export type StalledCheck = Schema<'StalledCheckDTO'>

export type Report = Schema<'ReportListItemDTO'>

export type HeldComment = Schema<'AdminCommentItemDTO'>

export type HeldWalkthrough = Schema<'AdminWalkthroughItemDTO'>

export type QueueSources = {
  cases: ScanCase[]
  stalled: StalledCheck[]
  reports: Report[]
  comments: HeldComment[]
  walkthroughs: HeldWalkthrough[]
}

export type QueueEntry =
  | { kind: 'malware'; key: string; at: string; deadline: string; to: string; subject: ScanCase }
  | {
      kind: 'stalled'
      key: string
      at: string
      deadline: string
      to: string
      subject: StalledCheck
    }
  | { kind: 'report'; key: string; at: string; deadline: undefined; to: string; subject: Report }
  | {
      kind: 'comment'
      key: string
      at: string
      deadline: undefined
      to: string
      subject: HeldComment
    }
  | {
      kind: 'walkthrough'
      key: string
      at: string
      deadline: undefined
      to: string
      subject: HeldWalkthrough
    }

export const queueLength = 10

export const heldComment = 2

function byUrgency(a: QueueEntry, b: QueueEntry): number {
  if (a.deadline !== undefined && b.deadline !== undefined) {
    return a.deadline.localeCompare(b.deadline)
  }
  if (a.deadline !== undefined || b.deadline !== undefined) {
    return a.deadline === undefined ? 1 : -1
  }
  return b.at.localeCompare(a.at)
}

export function queueOf(sources: QueueSources): QueueEntry[] {
  const entries: QueueEntry[] = [
    ...sources.cases.map((subject): QueueEntry => ({
      kind: 'malware',
      key: `malware-${subject.id}`,
      at: subject.created,
      deadline: subject.review_deadline,
      to: adminPaths.scanCase(subject.id),
      subject,
    })),
    ...sources.stalled.map((subject): QueueEntry => ({
      kind: 'stalled',
      key: `stalled-${subject.file_id}`,
      at: subject.uploaded,
      deadline: subject.deadline,
      to: adminPaths.checks,
      subject,
    })),
    ...sources.reports.map((subject): QueueEntry => ({
      kind: 'report',
      key: `report-${subject.id}`,
      at: subject.created,
      deadline: undefined,
      to: adminPaths.report(subject.id),
      subject,
    })),
    ...sources.comments.map((subject): QueueEntry => ({
      kind: 'comment',
      key: `comment-${subject.id}`,
      at: subject.created,
      deadline: undefined,
      to: adminPaths.comment(subject.id),
      subject,
    })),
    ...sources.walkthroughs.map((subject): QueueEntry => ({
      kind: 'walkthrough',
      key: `walkthrough-${subject.id}`,
      at: subject.updated,
      deadline: undefined,
      to: adminPaths.walkthrough(subject.id),
      subject,
    })),
  ]
  return entries.toSorted(byUrgency).slice(0, queueLength)
}

export function pendingOf(kind: QueueKind, pending: Pending): number {
  const counts: Record<QueueKind, number> = {
    malware: pending.malware_cases,
    stalled: pending.stalled_files,
    report: pending.reports,
    comment: pending.comments,
    walkthrough: pending.walkthroughs,
  }
  return counts[kind]
}

export function pendingTotal(pending: Pending): number {
  return queueKinds.reduce((sum, kind) => sum + pendingOf(kind, pending), 0)
}

export type Unlisted = {
  kind: QueueKind
  count: number
}

export function unlisted(queue: readonly QueueEntry[], pending: Pending): Unlisted[] {
  return queueKinds
    .map(kind => ({
      kind,
      count: pendingOf(kind, pending) - queue.filter(entry => entry.kind === kind).length,
    }))
    .filter(rest => rest.count > 0)
}
