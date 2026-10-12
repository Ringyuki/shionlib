import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import {
  defaultStatus,
  levels,
  openedKey,
  reasons,
  statuses,
  statusFilters,
  verdicts,
  type Filter,
  type Level,
  type Status,
} from './admin-report'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const idText = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

const status = v.fallback(v.picklist(statusFilters), defaultStatus)

const reason = v.fallback(v.optional(v.picklist(reasons)), undefined)

const opened = v.fallback(v.optional(idText), undefined)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    status: v.parse(status, search.get('status') ?? defaultStatus),
    reason: v.parse(reason, search.get('reason') ?? undefined),
    reporter: v.parse(opened, search.get('reporter') ?? undefined),
    uploader: v.parse(opened, search.get('uploader') ?? undefined),
    opened: v.parse(opened, search.get(openedKey) ?? undefined),
    page,
  }
}

export function statusFrom(raw: string): Status | undefined {
  const parsed = v.safeParse(v.picklist(statuses), raw)
  return parsed.success ? parsed.output : undefined
}

export function levelFrom(raw: string): Level | undefined {
  const parsed = v.safeParse(v.picklist(levels), raw)
  return parsed.success ? parsed.output : undefined
}

export const reviewCommand = v.object({
  id,
  verdict: v.picklist(verdicts),
  level: v.picklist(levels),
  remove: v.boolean(),
  note: v.string(),
  notify: v.boolean(),
})

export type Review = v.InferOutput<typeof reviewCommand>

export type ReviewValues = Omit<Review, 'id' | 'verdict'> & { verdict: Review['verdict'] | null }

export type ReviewIssue = 'verdict'

export type ReviewIssueMessage = (issue: ReviewIssue) => string

export function reviewForm(kit: FormKit, issue: ReviewIssueMessage) {
  return v.object({
    verdict: v.picklist(verdicts, issue('verdict')),
    level: v.picklist(levels),
    remove: v.boolean(),
    note: kit.text('ReviewReportInputBody', 'process_note'),
    notify: v.boolean(),
  })
}
