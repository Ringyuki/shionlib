import { describe, expect, it } from 'vitest'
import { accepts, defaultModel, draftOf, modelsFor, sceneHealth, timeoutMs } from './admin-ai-scene'
import { model, route, scene } from './admin-ai-testing'

const review = model(2, { name: 'gpt-5-mini' })
const screen = model(1, { name: 'omni-moderation-latest', moderation: true })
const retired = model(3, { enabled: false })

describe('which models a scene takes', () => {
  it('keeps moderation models for moderation output only', () => {
    expect(accepts('moderation', screen)).toBe(true)
    expect(accepts('moderation', review)).toBe(false)
    expect(accepts('object', review)).toBe(true)
    expect(accepts('text', screen)).toBe(false)
  })

  it('offers enabled models of the right kind', () => {
    expect(modelsFor({ output: 'object' }, [screen, review, retired])).toEqual([review])
    expect(modelsFor({ output: 'moderation' }, [screen, review, retired])).toEqual([screen])
  })

  it('finds the default model', () => {
    expect(defaultModel([screen, review])).toBeUndefined()
    expect(defaultModel([screen, { ...review, is_default: true }])?.id).toBe(2)
  })
})

describe('sceneHealth', () => {
  const effective = { id: 2, key: 'gpt-5-mini', name: 'gpt-5-mini', moderation: false }

  it('repeats the problem the API found', () => {
    expect(sceneHealth(scene('moderation_review', { problem: 'no_model' }), [])).toEqual({
      state: 'problem',
      problem: 'no_model',
    })
  })

  it('warns when some routes of the model are suspended', () => {
    const backed = model(2, {
      routes: [
        route(1),
        route(2, {
          status: 'suspended',
          provider: { id: 2, kind: 'compatible', name: 'OpenRouter' },
        }),
        route(3, {
          status: 'suspended',
          provider: { id: 2, kind: 'compatible', name: 'OpenRouter' },
        }),
      ],
    })
    expect(sceneHealth(scene('moderation_review', { effective }), [backed])).toEqual({
      state: 'thin',
      active: 1,
      suspended: ['OpenRouter'],
    })
  })

  it('is fine while every route works', () => {
    expect(
      sceneHealth(scene('moderation_review', { effective }), [model(2, { routes: [route(1)] })]),
    ).toEqual({ state: 'fine' })
  })
})

describe('the parameters of a scene', () => {
  it('shows the timeout in seconds and sends it in milliseconds', () => {
    const draft = draftOf(scene('moderation_review', { timeout_ms: 30_000, temperature: 0.2 }))
    expect(draft).toEqual({
      modelId: null,
      temperature: 0.2,
      maxOutputTokens: null,
      timeoutSeconds: 30,
    })
    expect(timeoutMs(draft)).toBe(30_000)
    expect(timeoutMs({ timeoutSeconds: null })).toBeUndefined()
  })
})
