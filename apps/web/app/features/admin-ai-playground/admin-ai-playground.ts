import type { Schema } from '~/shared/api/types'

export type Reply = Schema<'AiPlaygroundResultDTO'>

export type Attempt = Schema<'AiRequestDTO'>

export type SceneChoice = Pick<Schema<'AiSceneDTO'>, 'key' | 'label'>

export type ModelChoice = Schema<'AiModelDTO'>

export const targetKinds = ['scene', 'model', 'route'] as const

export type TargetKind = (typeof targetKinds)[number]

export type Target = { kind: TargetKind; id: string }

export const maxTargets = 3

export type Choices = {
  scenes: SceneChoice[]
  models: ModelChoice[]
}

export type Option = { value: string; label: string }

export function optionsOf(choices: Choices, kind: TargetKind): Option[] {
  switch (kind) {
    case 'scene':
      return choices.scenes.map(scene => ({ value: scene.key, label: scene.label }))
    case 'model':
      return choices.models.map(model => ({ value: String(model.id), label: model.name }))
    case 'route':
      return choices.models.flatMap(model =>
        (model.routes ?? []).map(route => ({
          value: String(route.id),
          label: `${model.name} · ${route.provider.name}`,
        })),
      )
  }
}

export function firstTarget(choices: Choices, taken: readonly Target[] = []): Target | undefined {
  for (const kind of targetKinds) {
    const free = optionsOf(choices, kind).find(
      option => !taken.some(target => target.kind === kind && target.id === option.value),
    )
    if (free !== undefined) {
      return { kind, id: free.value }
    }
  }
  return undefined
}

export function targetLabel(choices: Choices, target: Target): string {
  return optionsOf(choices, target.kind).find(option => option.value === target.id)?.label ?? ''
}

export type Exchange = {
  message: string
  reply: Reply | undefined
}

export type Message = { role: 'user' | 'assistant'; content: string }

export function historyOf(lane: readonly Exchange[], message: string): Message[] {
  const earlier = lane.flatMap(exchange =>
    exchange.reply?.ok === true && exchange.reply.output !== null
      ? [
          { role: 'user' as const, content: exchange.message },
          { role: 'assistant' as const, content: exchange.reply.output },
        ]
      : [],
  )
  return [...earlier, { role: 'user', content: message }]
}

export type Params = {
  system: string
  temperature: number | null
  maxOutputTokens: number | null
  structured: boolean
  schema: string
}

export const blankParams: Params = {
  system: '',
  temperature: null,
  maxOutputTokens: null,
  structured: false,
  schema: '',
}

export type Totals = {
  served: Attempt | undefined
  costUsd: number
}

export function totalsOf(reply: Reply): Totals {
  const attempts = reply.attempts ?? []
  return {
    served: attempts.at(-1),
    costUsd: attempts.reduce((sum, attempt) => sum + attempt.cost_usd, 0),
  }
}
