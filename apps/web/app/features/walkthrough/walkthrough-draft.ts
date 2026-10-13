import {
  blankDocument,
  isBlank,
  sameDocument,
  type RichDocument,
} from '~/shared/richtext/rich-text'
import { facesIn, type Face, type Route, type Walkthrough } from './walkthrough'
import { stepsFrom, textOf, type StepWords } from './walkthrough-steps'

export type RouteDraft = {
  key: string
  name: string
  named: boolean
  characters: number[]
  requires: string[]
  condition: string
  ending: string
  steps: string
}

export type Draft = { note: RichDocument; routes: RouteDraft[] }

export type Naming = { faces: readonly Face[]; separator: string }

export type Unfinished = { index: number; name: boolean; steps: boolean }

export type WrittenRoute = {
  [Field in keyof Route]: NonNullable<Route[Field]>
}

export type Written = { note: RichDocument | undefined; routes: WrittenRoute[] }

type Stored = Pick<Walkthrough, 'note' | 'routes'>

export function nameOf(characters: readonly number[], { faces, separator }: Naming): string {
  return facesIn({ characters: [...characters] }, faces)
    .map(face => face.name)
    .join(separator)
}

export function draftOf(stored: Stored | undefined, naming: Naming, words: StepWords): Draft {
  return {
    note: stored?.note ?? blankDocument,
    routes: (stored?.routes ?? []).map(route => {
      const characters = facesIn(route, naming.faces).map(face => face.id)
      return {
        key: route.key,
        name: route.name,
        named: route.name !== '' && route.name !== nameOf(characters, naming),
        characters,
        requires: route.requires ?? [],
        condition: route.condition,
        ending: route.ending,
        steps: textOf(route.steps ?? [], words),
      }
    }),
  }
}

export function withRoute(draft: Draft): Draft {
  const taken = new Set(draft.routes.map(route => route.key))
  let serial = draft.routes.length + 1
  while (taken.has(`r${serial}`)) {
    serial += 1
  }
  const added: RouteDraft = {
    key: `r${serial}`,
    name: '',
    named: false,
    characters: [],
    requires: [],
    condition: '',
    ending: '',
    steps: '',
  }
  return { ...draft, routes: [...draft.routes, added] }
}

export function withoutRoute(draft: Draft, key: string): Draft {
  return {
    ...draft,
    routes: draft.routes
      .filter(route => route.key !== key)
      .map(route => ({ ...route, requires: route.requires.filter(each => each !== key) })),
  }
}

export function withRouteMoved(draft: Draft, key: string, before: string): Draft {
  const from = draft.routes.findIndex(route => route.key === key)
  const to = draft.routes.findIndex(route => route.key === before)
  const moved = draft.routes[from]
  if (moved === undefined || to === -1 || from === to) {
    return draft
  }
  const routes = draft.routes.filter(route => route.key !== key)
  routes.splice(to, 0, moved)
  return { ...draft, routes }
}

export function withRouteChanged(
  draft: Draft,
  key: string,
  change: (route: RouteDraft) => RouteDraft,
): Draft {
  return {
    ...draft,
    routes: draft.routes.map(route => (route.key === key ? change(route) : route)),
  }
}

export function cast(route: RouteDraft, characters: number[], naming: Naming): RouteDraft {
  return route.named
    ? { ...route, characters }
    : { ...route, characters, name: nameOf(characters, naming) }
}

export function named(route: RouteDraft, name: string): RouteDraft {
  return { ...route, name, named: name.trim() !== '' }
}

export function routesOf(draft: Draft): WrittenRoute[] {
  return draft.routes.map(route => ({
    key: route.key,
    name: route.name.trim(),
    characters: route.characters,
    requires: route.requires,
    condition: route.condition.trim(),
    ending: route.ending.trim(),
    steps: stepsFrom(route.steps),
  }))
}

export function writtenOf(draft: Draft): Written {
  return { note: isBlank(draft.note) ? undefined : draft.note, routes: routesOf(draft) }
}

export function savesOf(draft: Draft): string[] {
  return routesOf(draft).flatMap(route =>
    route.steps.flatMap(step => (step.kind === 'save' ? step.slot : [])),
  )
}

export function unfinished(draft: Draft): Unfinished | undefined {
  const found = routesOf(draft).flatMap((route, index) => {
    const name = route.name === ''
    const steps = !route.steps.some(step => step.kind !== 'gap')
    return name || steps ? { index, name, steps } : []
  })
  return found[0]
}

export function sameDraft(left: Draft, right: Draft): boolean {
  if (left.note !== right.note && !sameDocument(left.note, right.note)) {
    return false
  }
  return (
    left.routes.length === right.routes.length &&
    left.routes.every((route, index) => sameRoute(route, right.routes[index]))
  )
}

function sameRoute(left: RouteDraft, right: RouteDraft | undefined): boolean {
  return (
    right !== undefined &&
    left.key === right.key &&
    left.name === right.name &&
    left.condition === right.condition &&
    left.ending === right.ending &&
    left.steps === right.steps &&
    left.characters.join() === right.characters.join() &&
    left.requires.join() === right.requires.join()
  )
}
