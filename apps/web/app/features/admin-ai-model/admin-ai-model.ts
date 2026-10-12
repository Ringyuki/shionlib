import type { Protocol } from '~/features/admin-ai'
import type { Schema } from '~/shared/api/types'

export type Model = Schema<'AiModelDTO'>

export type CatalogModel = Schema<'AiCatalogModelDTO'>

export type CatalogOffer = Schema<'AiCatalogOfferDTO'>

export type CatalogStatus = Schema<'AiCatalogStatusDTO'>

export type ProviderOption = Schema<'AiProviderDTO'>

export type SceneUse = Schema<'AiSceneDTO'>

export const capabilities = ['moderation', 'reasoning', 'vision'] as const

export type Capability = (typeof capabilities)[number]

export type Filter = {
  query: string
  capability: Capability | undefined
}

export const maxQueryLength = 60

export function matching(models: readonly Model[], filter: Filter): Model[] {
  const query = filter.query.toLowerCase()
  return models.filter(
    model =>
      (filter.capability === undefined || model[filter.capability]) &&
      (query === '' ||
        model.name.toLowerCase().includes(query) ||
        model.key.toLowerCase().includes(query) ||
        (model.canonical_id ?? '').toLowerCase().includes(query)),
  )
}

export function searchOf(filter: Filter): string {
  const search = new URLSearchParams()
  if (filter.query !== '') {
    search.set('q', filter.query)
  }
  if (filter.capability !== undefined) {
    search.set('capability', filter.capability)
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

export function identifierOf(model: Pick<Model, 'canonical_id' | 'key'>): string {
  return model.canonical_id ?? model.key
}

export function providersOf(model: Pick<Model, 'routes'>): string[] {
  return (model.routes ?? []).map(route => route.provider.name)
}

export type SettingsDraft = {
  name: string
  description: string
  isDefault: boolean
}

export function settingsOf(model: Model): SettingsDraft {
  return { name: model.name, description: model.description ?? '', isDefault: model.is_default }
}

export type SettingsChanges = {
  name?: string
  description?: string
  isDefault?: boolean
  enabled?: boolean
}

export function settingsChanges(model: Model, draft: SettingsDraft): SettingsChanges {
  const before = settingsOf(model)
  const name = draft.name.trim()
  const description = draft.description.trim()
  return {
    ...(name === before.name ? {} : { name }),
    ...(description === before.description ? {} : { description }),
    ...(draft.isDefault === before.isDefault ? {} : { isDefault: draft.isDefault }),
  }
}

export function oncePerProvider(offers: readonly CatalogOffer[] | null): CatalogOffer[] {
  const seen = new Set<number>()
  return (offers ?? []).filter(offer => {
    if (seen.has(offer.provider.id)) {
      return false
    }
    seen.add(offer.provider.id)
    return true
  })
}

export type NewRoute = { providerId: number; upstreamId: string; protocol: Protocol }

export type ModelResult =
  | { kind: 'created'; id: number }
  | { kind: 'synced'; added: number; updated: number; removed: number; repriced: number }
  | { kind: 'done' }

export function sceneRequests(scenes: readonly SceneUse[], key: string): number {
  return scenes.find(scene => scene.key === key)?.stats.requests ?? 0
}
