import type { Schema } from '~/shared/api/types'
import { isBlank, type RichDocument } from '~/shared/richtext/rich-text'
import { draftOf, nameOf, type Draft, type Naming, type RouteDraft } from './walkthrough-draft'
import type { StepWords } from './walkthrough-steps'

export type FormatTask = Schema<'WalkthroughFormatTaskDTO'>

export type Formatted = NonNullable<FormatTask['result']>

export const placements = ['append', 'replace'] as const

export type Placement = (typeof placements)[number]

export type Placed = { draft: Draft; added: string[] }

export const pollEvery = 2000

export function elapsedText(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function filled(draft: Draft): boolean {
  return !isBlank(draft.note) || draft.routes.length > 0
}

export function placed(
  draft: Draft,
  formatted: Formatted,
  placement: Placement,
  naming: Naming,
  words: StepWords,
  maxRoutes: number,
): Placed {
  const read = draftOf(formatted, naming, words)
  const routes = rekeyed(
    read.routes.map(route =>
      route.name === '' ? { ...route, name: nameOf(route.characters, naming) } : route,
    ),
    draft.routes.map(route => route.key),
  )
  const kept = placement === 'replace' ? [] : draft.routes
  const added = routes.slice(0, Math.max(0, maxRoutes - kept.length))
  return {
    draft: {
      note: placement === 'replace' ? read.note : joined(draft.note, read.note),
      routes: [...kept, ...added],
    },
    added: added.map(route => route.key),
  }
}

function rekeyed(routes: readonly RouteDraft[], taken: readonly string[]): RouteDraft[] {
  const used = new Set(taken)
  const renamed = new Map<string, string>()
  let serial = taken.length
  for (const route of routes) {
    serial += 1
    while (used.has(`r${serial}`)) {
      serial += 1
    }
    used.add(`r${serial}`)
    renamed.set(route.key, `r${serial}`)
  }
  return routes.map(route => ({
    ...route,
    key: renamed.get(route.key) ?? route.key,
    requires: route.requires.flatMap(key => renamed.get(key) ?? []),
  }))
}

function joined(left: RichDocument, right: RichDocument): RichDocument {
  if (isBlank(right)) {
    return left
  }
  if (isBlank(left)) {
    return right
  }
  return { ...left, content: [...left.content, ...right.content] }
}
