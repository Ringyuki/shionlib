import type { Schema } from '~/shared/api/types'

export type Scene = Schema<'AiSceneDTO'>

export type Model = Schema<'AiModelDTO'>

export type SceneOutput = Scene['output']

export const followDefault = 'default'

export function accepts(output: SceneOutput, model: Pick<Model, 'moderation'>): boolean {
  return model.moderation === (output === 'moderation')
}

export function modelsFor(scene: Pick<Scene, 'output'>, models: readonly Model[]): Model[] {
  return models.filter(model => model.enabled && accepts(scene.output, model))
}

export function defaultModel(models: readonly Model[]): Model | undefined {
  return models.find(model => model.is_default)
}

export type SceneHealth =
  | { state: 'problem'; problem: NonNullable<Scene['problem']> }
  | { state: 'thin'; active: number; suspended: string[] }
  | { state: 'fine' }

export function sceneHealth(scene: Scene, models: readonly Model[]): SceneHealth {
  if (scene.problem !== null) {
    return { state: 'problem', problem: scene.problem }
  }
  const routes = models.find(model => model.id === scene.effective?.id)?.routes ?? []
  const suspended = routes.filter(route => route.status === 'suspended')
  if (suspended.length === 0) {
    return { state: 'fine' }
  }
  return {
    state: 'thin',
    active: routes.filter(route => route.status === 'active').length,
    suspended: [...new Set(suspended.map(route => route.provider.name))],
  }
}

export type SceneDraft = {
  modelId: number | null
  temperature: number | null
  maxOutputTokens: number | null
  timeoutSeconds: number | null
}

const second = 1000

export function draftOf(scene: Scene): SceneDraft {
  return {
    modelId: scene.model?.id ?? null,
    temperature: scene.temperature,
    maxOutputTokens: scene.max_output_tokens,
    timeoutSeconds: scene.timeout_ms === null ? null : Math.round(scene.timeout_ms / second),
  }
}

export function timeoutMs(draft: Pick<SceneDraft, 'timeoutSeconds'>): number | undefined {
  return draft.timeoutSeconds === null ? undefined : draft.timeoutSeconds * second
}
