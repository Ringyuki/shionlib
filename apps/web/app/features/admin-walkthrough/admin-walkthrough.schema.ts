import * as v from 'valibot'
import {
  defaultSort,
  defaultStatus,
  maxQueryLength,
  openedKey,
  outcomes,
  sorts,
  statusFilters,
  type Filter,
} from './admin-walkthrough'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const idText = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

const status = v.fallback(v.picklist(statusFilters), defaultStatus)

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

const person = v.fallback(v.optional(idText), undefined)

const sort = v.fallback(v.picklist(sorts), defaultSort)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    status: v.parse(status, search.get('status') ?? defaultStatus),
    query: v.parse(query, search.get('q') ?? ''),
    author: v.parse(person, search.get('author') ?? undefined),
    sort: v.parse(sort, search.get('sort') ?? defaultSort),
    opened: v.parse(person, search.get(openedKey) ?? undefined),
    page,
  }
}

export const walkthroughCommand = v.variant('action', [
  v.object({ action: v.literal('status'), id, status: v.picklist(outcomes) }),
  v.object({ action: v.literal('rescan'), id }),
])

export type WalkthroughChange = v.InferOutput<typeof walkthroughCommand>

export type OutcomeValues = { status: (typeof outcomes)[number] | null }

export type WalkthroughIssue = 'outcome'

export type WalkthroughIssueMessage = (issue: WalkthroughIssue) => string

export function outcomeForm(issue: WalkthroughIssueMessage) {
  return v.object({ status: v.picklist(outcomes, issue('outcome')) })
}
