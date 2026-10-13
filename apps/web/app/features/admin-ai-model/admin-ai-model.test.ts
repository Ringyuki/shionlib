import { describe, expect, it } from 'vitest'
import {
  identifierOf,
  matching,
  oncePerProvider,
  sceneRequests,
  searchOf,
  settingsChanges,
  settingsOf,
} from './admin-ai-model'
import { model, offer } from './admin-ai-model-testing'

const review = model(2, {
  name: 'gpt-5-mini',
  key: 'gpt-5-mini',
  canonical_id: 'openai/gpt-5-mini',
  reasoning: true,
  vision: true,
})
const screen = model(1, { name: 'omni-moderation-latest', moderation: true, vision: true })

describe('the list', () => {
  it('narrows by name, identifier and capability', () => {
    const all = [screen, review]
    expect(matching(all, { query: 'OPENAI/', capability: undefined })).toEqual([review])
    expect(matching(all, { query: '', capability: 'moderation' })).toEqual([screen])
    expect(matching(all, { query: 'omni', capability: 'vision' })).toEqual([screen])
    expect(matching(all, { query: '', capability: 'reasoning' })).toEqual([review])
  })

  it('writes the filter into the address', () => {
    expect(searchOf({ query: '', capability: undefined })).toBe('')
    expect(searchOf({ query: 'gpt', capability: 'vision' })).toBe('?q=gpt&capability=vision')
  })

  it('shows the catalog identifier when the model has one', () => {
    expect(identifierOf(review)).toBe('openai/gpt-5-mini')
    expect(identifierOf(screen)).toBe('model-1')
  })
})

describe('settingsChanges', () => {
  it('sends only what was edited', () => {
    const draft = settingsOf(review)
    expect(settingsChanges(review, draft)).toEqual({})
    expect(
      settingsChanges(review, { name: ' Mini ', description: ' 复审用 ', isDefault: true }),
    ).toEqual({ name: 'Mini', description: '复审用', isDefault: true })
    const described = model(3, { description: '旧说明' })
    expect(settingsChanges(described, { ...settingsOf(described), description: '' })).toEqual({
      description: '',
    })
  })
})

describe('oncePerProvider', () => {
  it('keeps the first offer of each provider', () => {
    const offers = [
      offer(1, 'gpt-5-mini'),
      offer(1, 'gpt-5-mini-2026'),
      offer(2, 'openai/gpt-5-mini'),
    ]
    expect(oncePerProvider(offers).map(kept => kept.upstream_id)).toEqual([
      'gpt-5-mini',
      'openai/gpt-5-mini',
    ])
    expect(oncePerProvider(null)).toEqual([])
  })
})

describe('sceneRequests', () => {
  it('reads the requests of a scene, zero when it is unknown', () => {
    const scenes = [
      {
        key: 'moderation_review',
        label: '内容审核复审',
        output: 'object' as const,
        model: null,
        effective: null,
        temperature: null,
        max_output_tokens: null,
        timeout_ms: null,
        problem: null,
        stats: { requests: 112, failures: 7, first_token_ms: 400, cost_usd: 1.37 },
      },
    ]
    expect(sceneRequests(scenes, 'moderation_review')).toBe(112)
    expect(sceneRequests(scenes, 'gone')).toBe(0)
  })
})
