import type { ApiClient } from '~/shared/api/client'
import type { Choices, Reply } from './admin-ai-playground'
import { outlineFrom, type PlaygroundRun } from './admin-ai-playground.schema'

export async function loadChoices(api: ApiClient): Promise<Choices> {
  const [scenes, models] = await Promise.all([
    api.get('/admin/ai/scenes'),
    api.get('/admin/ai/models'),
  ])
  return {
    scenes: (scenes ?? []).map(({ key, label }) => ({ key, label })),
    models: (models ?? []).filter(model => model.enabled),
  }
}

export async function runPlayground(api: ApiClient, run: PlaygroundRun): Promise<Reply | null> {
  const schema = run.schema === null ? undefined : outlineFrom(run.schema)
  const played = await api.post('/admin/ai/playground/runs', {
    body: {
      targets: [run.target],
      messages: run.messages,
      ...(run.system.trim() === '' ? {} : { system: run.system }),
      ...(run.temperature === null ? {} : { temperature: run.temperature }),
      ...(run.maxOutputTokens === null ? {} : { max_output_tokens: run.maxOutputTokens }),
      ...(schema === undefined ? {} : { schema }),
    },
  })
  return played.results?.[0] ?? null
}
