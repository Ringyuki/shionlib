import type { ApiClient } from '~/shared/api/client'
import type { Range } from './admin-ai'
import { failuresShown, providerUsage, sceneUsage, type Overview } from './admin-ai-overview'
import { timeoutMs, type Model, type Scene } from './admin-ai-scene'
import type { SceneSave } from './admin-ai.schema'

export async function loadOverview(api: ApiClient, range: Range): Promise<Overview> {
  const [usage, series, byScene, byProvider, scenes, providers, failures] = await Promise.all([
    api.get('/admin/ai/overview', { params: { query: { range } } }),
    api.get('/admin/ai/overview/costs', { params: { query: { range } } }),
    api.get('/admin/ai/overview/breakdown', { params: { query: { range, by: 'scene' } } }),
    api.get('/admin/ai/overview/breakdown', { params: { query: { range, by: 'provider' } } }),
    api.get('/admin/ai/scenes'),
    api.get('/admin/ai/providers'),
    api.get('/admin/ai/requests', {
      params: { query: { range, source: 'scene', ok: 'false', page: 1, pageSize: failuresShown } },
    }),
  ])
  return {
    range,
    usage,
    series,
    scenes: sceneUsage(scenes ?? [], byScene ?? []),
    providers: providerUsage(providers ?? [], byProvider ?? []),
    failures: failures.items ?? [],
  }
}

export type SceneListing = {
  scenes: Scene[]
  models: Model[]
  opened: Scene | undefined
}

export async function loadScenes(api: ApiClient, openedKey: string | null): Promise<SceneListing> {
  const [listed, models] = await Promise.all([
    api.get('/admin/ai/scenes'),
    api.get('/admin/ai/models'),
  ])
  const scenes = listed ?? []
  return {
    scenes,
    models: models ?? [],
    opened: scenes.find(scene => scene.key === openedKey),
  }
}

export async function saveScene(api: ApiClient, save: SceneSave): Promise<null> {
  const timeout = timeoutMs(save)
  await api.put('/admin/ai/scenes/{key}', {
    params: { path: { key: save.key } },
    body: {
      ...(save.modelId === null ? {} : { model_id: save.modelId }),
      ...(save.temperature === null ? {} : { temperature: save.temperature }),
      ...(save.maxOutputTokens === null ? {} : { max_output_tokens: save.maxOutputTokens }),
      ...(timeout === undefined ? {} : { timeout_ms: timeout }),
    },
  })
  return null
}
