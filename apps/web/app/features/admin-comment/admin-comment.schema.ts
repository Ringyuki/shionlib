import * as v from 'valibot'
import { categories } from '~/features/admin'
import type { FormKit } from '~/shared/form/form-kit'
import {
  defaultSort,
  defaultStatus,
  everyStatus,
  maxQueryLength,
  openedKey,
  sorts,
  statuses,
  verdicts,
  type Filter,
  type Status,
  type StatusFilter,
} from './admin-comment'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const idText = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

const statusText = v.pipe(v.string(), v.toNumber(), v.picklist(statuses))

const status = v.fallback(v.union([v.literal(everyStatus), statusText]), defaultStatus)

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

const person = v.fallback(v.optional(idText), undefined)

const sort = v.fallback(v.picklist(sorts), defaultSort)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    status: v.parse(status, search.get('status') ?? String(defaultStatus)),
    query: v.parse(query, search.get('q') ?? ''),
    author: v.parse(person, search.get('author') ?? undefined),
    sort: v.parse(sort, search.get('sort') ?? defaultSort),
    opened: v.parse(person, search.get(openedKey) ?? undefined),
    page,
  }
}

export function statusFrom(raw: number): Status | undefined {
  const parsed = v.safeParse(v.picklist(statuses), raw)
  return parsed.success ? parsed.output : undefined
}

export function statusFilterFrom(raw: string | number): StatusFilter | undefined {
  const parsed = v.safeParse(
    v.union([v.literal(everyStatus), v.picklist(statuses), statusText]),
    raw,
  )
  return parsed.success ? parsed.output : undefined
}

export const maxBatch = 50

export const commentCommand = v.variant('action', [
  v.object({
    action: v.literal('review'),
    ids: v.pipe(v.array(id), v.minLength(1), v.maxLength(maxBatch)),
    status: v.picklist(verdicts),
    category: v.picklist(categories),
    reason: v.string(),
    notify: v.boolean(),
  }),
  v.object({ action: v.literal('rescan'), id }),
])

export type CommentChange = v.InferOutput<typeof commentCommand>

export type Review = Extract<CommentChange, { action: 'review' }>

export type ReviewValues = Omit<Review, 'action' | 'ids' | 'status'> & {
  status: Review['status'] | null
}

export type CommentIssue = 'verdict'

export type CommentIssueMessage = (issue: CommentIssue) => string

export function reviewForm(kit: FormKit, issue: CommentIssueMessage) {
  return v.object({
    status: v.picklist(verdicts, issue('verdict')),
    category: v.picklist(categories),
    reason: kit.text('AdminCommentStatusInputBody', 'reason'),
    notify: v.boolean(),
  })
}
