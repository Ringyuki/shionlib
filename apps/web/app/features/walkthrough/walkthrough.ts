import { castPicture, characterName } from '~/features/character'
import { gamePath } from '~/features/game'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type Walkthrough = Schema<'WalkthroughDTO'>

export type Route = Schema<'WalkthroughRouteDTO'>

export type WalkthroughSummary = Schema<'WalkthroughSummaryDTO'>

export type UserWalkthrough = Schema<'UserWalkthroughDTO'>

type Portrayed = Pick<
  Schema<'GameCharacterDTO'>,
  'id' | 'name_jp' | 'name_zh' | 'name_en' | 'image' | 'image_thumb_hash'
>

export type Credit = Pick<Schema<'GameCharacterCreditDTO'>, 'image' | 'image_thumb_hash'> & {
  character: Portrayed
}

export type Face = { id: number; name: string; picture: string | undefined; thumbhash?: string }

export type Portrait = { id: number; picture: string }

export type WalkthroughState = 'published' | 'draft' | 'reviewing' | 'hidden'

export type Guides = {
  gameId: number
  summaries: WalkthroughSummary[]
  shown: Walkthrough | undefined
}

export type UserWalkthroughs = { items: UserWalkthrough[]; total: number; page: number }

export type Linked = { ordinal: number; name: string }

export type Row =
  | { kind: 'choice'; number: number; text: string; remark: string }
  | { kind: 'save'; slot: string }
  | { kind: 'load'; slot: string; source: Linked | undefined }
  | { kind: 'note'; text: string }
  | { kind: 'gap' }
  | { kind: 'ending'; text: string }

type Stated = Pick<WalkthroughSummary, 'status' | 'review_pending'>

export const userPageSize = 20

export const routeKey = 'route'

export const portraitsShown = 2

export function walkthroughsPath(locale: Locale, gameId: number): string {
  return gamePath(locale, gameId, 'walkthrough')
}

export function walkthroughPath(locale: Locale, gameId: number, walkthroughId: number): string {
  return `${walkthroughsPath(locale, gameId)}/${walkthroughId}`
}

export function writingPath(locale: Locale, gameId: number): string {
  return `${walkthroughsPath(locale, gameId)}/edit`
}

export function routeSearch(index: number): string {
  return `?${routeKey}=${index + 1}`
}

export function saveAnchor(slot: string): string {
  return `save-${numbered(slot)}`
}

export function stateOf(walkthrough: Stated): WalkthroughState {
  if (walkthrough.status === 'PUBLISHED') {
    return 'published'
  }
  if (walkthrough.status === 'DRAFT') {
    return 'draft'
  }
  return walkthrough.review_pending ? 'reviewing' : 'hidden'
}

export function writtenBy(
  summaries: readonly WalkthroughSummary[],
  viewerId: number | undefined,
): WalkthroughSummary | undefined {
  return summaries.find(summary => summary.creator.id === viewerId)
}

export function facesOf(credits: readonly Credit[], locale: Locale): Face[] {
  return credits.map(credit => {
    const { src, thumbhash } = castPicture(credit)
    return {
      id: credit.character.id,
      name: characterName(credit.character, locale),
      picture: src,
      thumbhash,
    }
  })
}

export function facesIn(route: Pick<Route, 'characters'>, faces: readonly Face[]): Face[] {
  return (route.characters ?? []).flatMap(id => faces.find(face => face.id === id) ?? [])
}

export function portraitsIn(route: Pick<Route, 'characters'>, faces: readonly Face[]): Portrait[] {
  return facesIn(route, faces).flatMap(({ id, picture }) =>
    picture === undefined ? [] : { id, picture },
  )
}

export function shownRoute(
  routes: readonly Route[],
  ordinal: number | undefined,
): number | undefined {
  if (routes.length === 0) {
    return undefined
  }
  return ordinal !== undefined && ordinal <= routes.length ? ordinal - 1 : 0
}

export function conditioned(route: Pick<Route, 'requires' | 'condition'>): boolean {
  return (route.requires ?? []).length > 0 || route.condition !== ''
}

export function requiredBy(routes: readonly Route[], index: number): Linked[] {
  const required = routes[index]?.requires ?? []
  return routes.flatMap((route, at) =>
    required.includes(route.key) ? { ordinal: at + 1, name: route.name } : [],
  )
}

export function rowsOf(routes: readonly Route[], index: number): Row[] {
  const route = routes[index]
  if (route === undefined) {
    return []
  }
  let choices = 0
  const rows = (route.steps ?? []).map((step): Row => {
    switch (step.kind) {
      case 'choice':
        choices += 1
        return { kind: 'choice', number: choices, text: step.text, remark: step.remark }
      case 'save':
        return { kind: 'save', slot: step.slot }
      case 'load':
        return { kind: 'load', slot: step.slot, source: savedIn(routes, index, step.slot) }
      case 'note':
        return { kind: 'note', text: step.text }
      case 'gap':
        return { kind: 'gap' }
    }
  })
  return route.ending === '' ? rows : [...rows, { kind: 'ending', text: route.ending }]
}

function savedIn(routes: readonly Route[], index: number, slot: string): Linked | undefined {
  const saves = (route: Route) =>
    (route.steps ?? []).some(step => step.kind === 'save' && numbered(step.slot) === numbered(slot))
  const here = routes[index]
  if (here === undefined || saves(here)) {
    return undefined
  }
  const earlier = routes.slice(0, index).findLastIndex(saves)
  const found = earlier === -1 ? routes.findIndex(saves) : earlier
  const source = routes[found]
  return source === undefined ? undefined : { ordinal: found + 1, name: source.name }
}

function numbered(slot: string): string {
  return slot.replace(/^0+(?=\d)/, '')
}
