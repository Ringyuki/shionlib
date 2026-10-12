import { ApiError } from '~/shared/api/error'
import type { ApiClient } from '~/shared/api/client'
import type {
  Filter,
  Logged,
  LoggedDetail,
  ModelOption,
  ProviderOption,
  SceneOption,
  Summary,
} from './admin-ai-request'

export type Listing = {
  filter: Filter
  requests: Logged[]
  total: number
  summary: Summary
  scenes: SceneOption[]
  models: ModelOption[]
  providers: ProviderOption[]
  opened: LoggedDetail | undefined
}

const notFound = 404

async function loadOpened(api: ApiClient, id: string | undefined) {
  if (id === undefined) {
    return undefined
  }
  try {
    return await api.get('/admin/ai/requests/{id}', { params: { path: { id } } })
  } catch (error) {
    if (error instanceof ApiError && error.status === notFound) {
      return undefined
    }
    throw error
  }
}

export async function loadRequests(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const query = {
    range: filter.range,
    ...(filter.source === undefined ? {} : { source: filter.source }),
    ...(filter.scene === undefined ? {} : { scene: filter.scene }),
    ...(filter.modelId === undefined ? {} : { model_id: filter.modelId }),
    ...(filter.providerId === undefined ? {} : { provider_id: filter.providerId }),
    ...(filter.result === undefined
      ? {}
      : { ok: filter.result === 'ok' ? ('true' as const) : ('false' as const) }),
    ...(filter.errorKind === undefined ? {} : { error_kind: filter.errorKind }),
  }
  const [page, summary, scenes, models, providers, opened] = await Promise.all([
    api.get('/admin/ai/requests', { params: { query: { ...query, page: filter.page, pageSize } } }),
    api.get('/admin/ai/requests/summary', { params: { query } }),
    api.get('/admin/ai/scenes'),
    api.get('/admin/ai/models'),
    api.get('/admin/ai/providers'),
    loadOpened(api, filter.opened),
  ])
  return {
    filter,
    requests: page.items ?? [],
    total: page.meta.totalItems,
    summary,
    scenes: (scenes ?? []).map(({ key, label }) => ({ key, label })),
    models: (models ?? []).map(({ id, name }) => ({ id, name })),
    providers: (providers ?? []).map(({ id, name }) => ({ id, name })),
    opened,
  }
}
