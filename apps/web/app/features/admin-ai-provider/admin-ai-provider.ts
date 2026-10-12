import type { Protocol, ProviderKind } from '~/features/admin-ai'
import type { Schema } from '~/shared/api/types'

export type Provider = Schema<'AiProviderDTO'>

export type ProviderDetail = Schema<'AiProviderDetailDTO'>

export type Preset = Schema<'AiCatalogProviderDTO'>

export type Discovery = Schema<'AiDiscoveryDTO'>

export type Discovered = Schema<'AiDiscoveredModelDTO'>

export type Resolved = Schema<'AiResolvedModelDTO'>

export const providerStates = ['fine', 'suspended', 'off'] as const

export type ProviderState = (typeof providerStates)[number]

export type Filter = {
  query: string
  state: ProviderState | undefined
}

export const maxQueryLength = 60

export function stateOf(provider: Pick<Provider, 'enabled' | 'route_counts'>): ProviderState {
  if (!provider.enabled) {
    return 'off'
  }
  return provider.route_counts.suspended > 0 ? 'suspended' : 'fine'
}

export function matching(providers: readonly Provider[], filter: Filter): Provider[] {
  const query = filter.query.toLowerCase()
  return providers.filter(
    provider =>
      (filter.state === undefined || stateOf(provider) === filter.state) &&
      (query === '' ||
        provider.name.toLowerCase().includes(query) ||
        (provider.base_url ?? '').toLowerCase().includes(query)),
  )
}

export function searchOf(filter: Filter): string {
  const search = new URLSearchParams()
  if (filter.query !== '') {
    search.set('q', filter.query)
  }
  if (filter.state !== undefined) {
    search.set('state', filter.state)
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

export type ProviderDraft = {
  presetId: string | null
  name: string
  kind: ProviderKind
  baseUrl: string
  apiKey: string
  priceMultiplier: number | null
}

export const blankDraft: ProviderDraft = {
  presetId: null,
  name: '',
  kind: 'compatible',
  baseUrl: '',
  apiKey: '',
  priceMultiplier: 1,
}

export function withPreset(draft: ProviderDraft, preset: Preset | undefined): ProviderDraft {
  if (preset === undefined) {
    return { ...draft, presetId: null }
  }
  return {
    ...draft,
    presetId: preset.id,
    name: preset.name,
    kind: preset.kind,
    baseUrl: preset.base_url ?? '',
  }
}

export type SettingsDraft = Pick<ProviderDraft, 'name' | 'baseUrl' | 'apiKey' | 'priceMultiplier'>

export function settingsOf(provider: Provider): SettingsDraft {
  return {
    name: provider.name,
    baseUrl: provider.base_url ?? '',
    apiKey: '',
    priceMultiplier: provider.price_multiplier,
  }
}

export type SettingsChanges = {
  name?: string
  baseUrl?: string
  apiKey?: string
  priceMultiplier?: number
}

export function settingsChanges(provider: Provider, draft: SettingsDraft): SettingsChanges {
  const before = settingsOf(provider)
  const name = draft.name.trim()
  const baseUrl = draft.baseUrl.trim()
  return {
    ...(name === before.name ? {} : { name }),
    ...(baseUrl === before.baseUrl ? {} : { baseUrl }),
    ...(draft.apiKey === '' ? {} : { apiKey: draft.apiKey }),
    ...(draft.priceMultiplier === null || draft.priceMultiplier === before.priceMultiplier
      ? {}
      : { priceMultiplier: draft.priceMultiplier }),
  }
}

export type Placement = 'added' | 'joins' | 'creates'

export function placementOf(found: Pick<Discovered, 'route_id' | 'model_id'>): Placement {
  if (found.route_id !== null) {
    return 'added'
  }
  return found.model_id === null ? 'creates' : 'joins'
}

export function discoveredMatching(models: readonly Discovered[], query: string): Discovered[] {
  const wanted = query.trim().toLowerCase()
  return wanted === ''
    ? [...models]
    : models.filter(
        model =>
          model.name.toLowerCase().includes(wanted) ||
          model.upstream_id.toLowerCase().includes(wanted),
      )
}

export type RouteItem = { upstreamId: string; protocol: Protocol }

export type ProviderResult =
  | { kind: 'created'; id: number }
  | { kind: 'discovered'; discovery: Discovery }
  | { kind: 'added'; added: number; skipped: string[] }
  | { kind: 'checked'; checked: number; failed: number }
  | { kind: 'done' }

export const checksAtOnce = 4
