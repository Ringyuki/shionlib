import { adminPaths } from '~/features/admin'
import type { Schema } from '~/shared/api/types'

export const aiTabs = [
  'overview',
  'providers',
  'models',
  'scenes',
  'requests',
  'playground',
] as const

export type AiTab = (typeof aiTabs)[number]

export const ranges = ['1h', '24h', '7d', '30d'] as const

export type Range = (typeof ranges)[number]

export const defaultRange: Range = '24h'

const root = adminPaths.ai

export const aiPaths = {
  overview: root,
  providers: `${root}/providers`,
  models: `${root}/models`,
  scenes: `${root}/scenes`,
  requests: `${root}/requests`,
  playground: `${root}/playground`,
  provider: (id: number) => `${root}/providers/${id}`,
  model: (id: number) => `${root}/models/${id}`,
  request: (id: string, range: Range) => `${root}/requests?range=${range}&id=${id}`,
  requestsIn: (range: Range) => `${root}/requests?range=${range}`,
} as const

export type Stats = Schema<'AiStatsDTO'>

export const noStats: Stats = { requests: 0, failures: 0, first_token_ms: null, cost_usd: 0 }

export function failureRate(stats: Pick<Stats, 'requests' | 'failures'>): number | undefined {
  return stats.requests === 0 ? undefined : stats.failures / stats.requests
}

export const protocols = ['chat', 'responses', 'messages', 'gemini', 'moderation'] as const

export type Protocol = (typeof protocols)[number]

export const protocolNames: Record<Protocol, string> = {
  chat: 'Chat Completions',
  responses: 'Responses',
  messages: 'Messages',
  gemini: 'Gemini',
  moderation: 'Moderations',
}

export function protocolName(protocol: string): string {
  const known = protocols.find(candidate => candidate === protocol)
  return known === undefined ? protocol : protocolNames[known]
}

export const providerKinds = ['compatible', 'openai', 'anthropic', 'google'] as const

export type ProviderKind = (typeof providerKinds)[number]

export const officialHosts: Record<ProviderKind, string> = {
  compatible: '',
  openai: 'api.openai.com',
  anthropic: 'api.anthropic.com',
  google: 'generativelanguage.googleapis.com',
}

export function hostOf(provider: Pick<Schema<'AiProviderDTO'>, 'kind' | 'base_url'>): string {
  if (provider.base_url === null || provider.base_url === '') {
    return officialHosts[provider.kind]
  }
  const [, rest = provider.base_url] = provider.base_url.split('://')
  return rest.endsWith('/') ? rest.slice(0, -1) : rest
}

export const errorKinds = [
  'auth',
  'quota',
  'not_found',
  'protocol',
  'param',
  'structured',
  'rate_limit',
  'upstream',
  'network',
  'timeout',
  'malformed',
  'truncated',
  'other',
] as const

export type ErrorKind = (typeof errorKinds)[number]

export function errorKindOf(raw: string): ErrorKind {
  return errorKinds.find(kind => kind === raw) ?? 'other'
}

const passing: readonly ErrorKind[] = ['rate_limit', 'timeout', 'truncated']

export function errorTone(kind: ErrorKind): 'danger' | 'warning' {
  return passing.includes(kind) ? 'warning' : 'danger'
}

const thousand = 1000

export function tokenCount(tokens: number): string {
  if (tokens >= thousand * thousand) {
    return `${Number((tokens / thousand / thousand).toFixed(1))}M`
  }
  return tokens >= thousand ? `${Math.round(tokens / thousand)}K` : String(tokens)
}

export type RouteCounts = Schema<'AiRouteCountsDTO'>

export type Health =
  | { state: 'off'; total: number }
  | { state: 'empty' }
  | { state: 'suspended'; suspended: number; total: number }
  | { state: 'fine'; active: number; total: number }

export function healthOf(enabled: boolean, counts: RouteCounts): Health {
  if (counts.total === 0) {
    return { state: 'empty' }
  }
  if (!enabled) {
    return { state: 'off', total: counts.total }
  }
  if (counts.suspended > 0) {
    return { state: 'suspended', suspended: counts.suspended, total: counts.total }
  }
  return { state: 'fine', active: counts.active, total: counts.total }
}

export type RequestSource = Pick<Schema<'AiRequestDTO'>, 'source' | 'scene'>

export type SceneName = Pick<Schema<'AiSceneDTO'>, 'key' | 'label'>

export function sceneLabel(
  request: RequestSource,
  scenes: readonly SceneName[],
): string | undefined {
  if (request.source !== 'scene' || request.scene === null) {
    return undefined
  }
  return scenes.find(scene => scene.key === request.scene)?.label ?? request.scene
}
