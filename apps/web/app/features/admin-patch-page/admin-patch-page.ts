import { constraints } from '~/shared/api/generated/constraints'
import type { Schema } from '~/shared/api/types'

export type PatchPage = Schema<'PatchPageDTO'>
export type PatchPages = Schema<'AdminPatchPagesDTO'>
export type Via = NonNullable<PatchPage['via']>

export type Loaded = {
  id: number
  pages: PatchPages
}

export type Draft = {
  manual: boolean
  assigned: PatchPage[]
}

export type Target = {
  id: number
  name: string
}

export const maxPages = constraints.AdminPatchPagesAssignInputBody.pages.maxItems

export const sourceNames: Record<Via['source'], string> = { vndb: 'VNDB', bangumi: 'Bangumi' }

export function matchedOf(pages: PatchPages): PatchPage[] {
  return pages.matched ?? []
}

export function draftOf(pages: PatchPages): Draft {
  return {
    manual: pages.manual,
    assigned: pages.manual ? (pages.assigned ?? []) : matchedOf(pages),
  }
}

export function shownPages(pages: PatchPages, draft: Draft): PatchPage[] {
  return draft.manual ? draft.assigned : matchedOf(pages)
}

export function withPage(draft: Draft, page: PatchPage): Draft {
  return { ...draft, assigned: [...draft.assigned, page] }
}

export function withoutPage(draft: Draft, id: string): Draft {
  return { ...draft, assigned: draft.assigned.filter(page => page.id !== id) }
}

export function listed(draft: Draft, id: string): boolean {
  return draft.assigned.some(page => page.id === id)
}

export function full(draft: Draft): boolean {
  return draft.assigned.length >= maxPages
}

export function addressOf(page: PatchPage): string {
  const address = new URL(page.url)
  return `${address.host}${address.pathname}`
}

export function nameOf(page: PatchPage): string {
  return page.title ?? addressOf(page)
}
