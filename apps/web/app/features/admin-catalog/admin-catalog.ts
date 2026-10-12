import type { Schema } from '~/shared/api/types'

export type Source = Schema<'CatalogSourceDTO'>

export type Hit = Schema<'CatalogHitDTO'>

export type Excluded = Schema<'CatalogExcludedDTO'>

export type Authorization = Schema<'BangumiAuthorizationDTO'>

export const entities = ['game', 'developer', 'character'] as const

export type Entity = (typeof entities)[number]

export type SourceState = 'failed' | 'fine' | 'never' | 'manual'

export function stateOf(
  source: Pick<Source, 'incremental' | 'pulled_at' | 'failed_at'>,
): SourceState {
  if (!source.incremental) {
    return 'manual'
  }
  if (source.failed_at !== null) {
    return 'failed'
  }
  return source.pulled_at === null ? 'never' : 'fine'
}

const spans = [
  { unit: 'day', seconds: 24 * 60 * 60 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
] as const

export type Span = { unit: (typeof spans)[number]['unit']; count: number }

export function spanOf(seconds: number): Span {
  const whole = spans.find(span => seconds >= span.seconds && seconds % span.seconds === 0)
  const { unit, seconds: size } = whole ?? spans.find(span => seconds >= span.seconds) ?? spans[2]
  return { unit, count: Math.round(seconds / size) }
}

export type Lookup = {
  source: string
  entity: Entity
  query: string
}

export type SearchState = 'idle' | 'searching' | 'failed' | 'done'

export function searchStateOf(search: {
  query: string
  waiting: boolean
  failed: boolean
}): SearchState {
  if (search.query === '') {
    return 'idle'
  }
  if (search.waiting) {
    return 'searching'
  }
  return search.failed ? 'failed' : 'done'
}

export const hitsShown = 10

export const excludedShown = 10

export const maxQueryLength = 100

export type HitState = 'here' | 'excluded' | 'absent'

export function hitState(hit: Pick<Hit, 'local_id' | 'excluded'>): HitState {
  if (hit.excluded) {
    return 'excluded'
  }
  return hit.local_id === null ? 'absent' : 'here'
}

export function numbered(hit: Pick<Hit, 'title'>): boolean {
  return hit.title === ''
}

export const bangumiOutcomes = ['authorized', 'failed'] as const

export type BangumiOutcome = (typeof bangumiOutcomes)[number]

export const bangumiOutcomeParam = 'bangumi'

export type BangumiState = 'unset' | 'pending' | 'authorized'

export function bangumiState(
  authorization: Pick<Authorization, 'configured' | 'authorized'>,
): BangumiState {
  if (authorization.authorized) {
    return 'authorized'
  }
  return authorization.configured ? 'pending' : 'unset'
}

export type CatalogResult = { kind: 'synced'; changes: number } | { kind: 'imported'; id: number }
