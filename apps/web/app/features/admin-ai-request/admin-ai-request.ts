import type { ErrorKind, Range } from '~/features/admin-ai'
import type { Schema } from '~/shared/api/types'

export type Logged = Schema<'AiRequestDTO'>

export type LoggedDetail = Schema<'AiRequestDetailDTO'>

export type Summary = Schema<'AiSummaryDTO'>

export type SceneOption = Pick<Schema<'AiSceneDTO'>, 'key' | 'label'>

export type ModelOption = Pick<Schema<'AiModelDTO'>, 'id' | 'name'>

export type ProviderOption = Pick<Schema<'AiProviderDTO'>, 'id' | 'name'>

export const sources = ['scene', 'check', 'playground'] as const

export type Source = (typeof sources)[number]

export const results = ['ok', 'failed'] as const

export type Result = (typeof results)[number]

export type Narrowing = {
  range: Range
  source: Source | undefined
  scene: string | undefined
  modelId: number | undefined
  providerId: number | undefined
  result: Result | undefined
  errorKind: ErrorKind | undefined
}

export type Filter = Narrowing & {
  page: number
  opened: string | undefined
}

export function searchOf(filter: Narrowing): string {
  const search = new URLSearchParams({ range: filter.range })
  const entries: [string, string | number | undefined][] = [
    ['source', filter.source],
    ['scene', filter.scene],
    ['model', filter.modelId],
    ['provider', filter.providerId],
    ['result', filter.result],
    ['error', filter.errorKind],
  ]
  for (const [key, value] of entries) {
    if (value !== undefined) {
      search.set(key, String(value))
    }
  }
  return `?${search}`
}

export function narrowed(filter: Narrowing): boolean {
  return [
    filter.source,
    filter.scene,
    filter.modelId,
    filter.providerId,
    filter.result,
    filter.errorKind,
  ].some(value => value !== undefined)
}

const scenePrefix = 'scene:'

export const everySource = 'all'

export function sourceChoice(filter: Pick<Narrowing, 'source' | 'scene'>): string {
  if (filter.source === 'scene' && filter.scene !== undefined) {
    return `${scenePrefix}${filter.scene}`
  }
  return filter.source ?? everySource
}

export function sceneChoice(key: string): string {
  return `${scenePrefix}${key}`
}

export function fromSourceChoice(choice: string): Pick<Narrowing, 'source' | 'scene'> {
  if (choice.startsWith(scenePrefix)) {
    return { source: 'scene', scene: choice.slice(scenePrefix.length) }
  }
  return { source: sources.find(source => source === choice), scene: undefined }
}

export type Adaptation =
  { kind: 'protocol'; protocol: string } | { kind: 'drop'; param: string } | { kind: 'json_mode' }

export function adaptationOf(label: string | null): Adaptation | undefined {
  if (label === null || label === '') {
    return undefined
  }
  const [kind, value = ''] = label.split(':')
  if (kind === 'protocol') {
    return { kind, protocol: value }
  }
  if (kind === 'drop') {
    return { kind, param: value }
  }
  return kind === 'json_mode' ? { kind } : undefined
}

export const callIdShown = 8

export function shortCall(request: Pick<Logged, 'call_id'>): string {
  return request.call_id.slice(0, callIdShown)
}
