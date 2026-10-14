import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import {
  decisions,
  openedKey,
  outcomeKey,
  outcomes,
  type Filter,
  type Outcome,
} from './admin-check'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const idText = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

const outcome = v.fallback(v.optional(v.picklist(outcomes)), undefined)

const opened = v.fallback(v.optional(idText), undefined)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    outcome: v.parse(outcome, search.get(outcomeKey) ?? undefined),
    opened: v.parse(opened, search.get(openedKey) ?? search.get('id') ?? undefined),
    page,
  }
}

export function outcomeFrom(raw: string | null): Outcome | undefined {
  const parsed = v.safeParse(v.picklist(outcomes), raw)
  return parsed.success ? parsed.output : undefined
}

export const caseReviewCommand = v.object({
  id,
  decision: v.picklist(decisions),
  note: v.string(),
  notify: v.boolean(),
})

export type CaseReview = v.InferOutput<typeof caseReviewCommand>

export type CaseReviewValues = Omit<CaseReview, 'id' | 'decision'> & {
  decision: CaseReview['decision'] | null
}

export type CheckIssue = 'decision'

export type CheckIssueMessage = (issue: CheckIssue) => string

export function caseReviewForm(kit: FormKit, issue: CheckIssueMessage) {
  return v.object({
    decision: v.picklist(decisions, issue('decision')),
    note: kit.text('ReviewMalwareCaseInputBody', 'review_note'),
    notify: v.boolean(),
  })
}

export const maxBatch = 100

const ids = v.pipe(v.array(id), v.minLength(1), v.maxLength(maxBatch))

export const quickReviewCommand = v.object({
  ids,
  decision: v.picklist(decisions),
})

export type QuickReview = v.InferOutput<typeof quickReviewCommand>

export const stalledCommand = v.object({
  fileIds: ids,
  action: v.picklist(['recheck', 'remove']),
})

export type StalledChange = v.InferOutput<typeof stalledCommand>
