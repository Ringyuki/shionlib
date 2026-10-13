import { describe, expect, it } from 'vitest'
import {
  blankDraft,
  discoveredMatching,
  matching,
  placementOf,
  searchOf,
  settingsChanges,
  settingsOf,
  stateOf,
  withPreset,
} from './admin-ai-provider'
import { discovered, provider } from './admin-ai-provider-testing'

const fine = provider(1, { name: 'OpenAI', kind: 'openai', base_url: null })
const broken = provider(2, {
  name: 'OpenRouter',
  base_url: 'https://openrouter.ai/api/v1',
  route_counts: { total: 2, active: 1, suspended: 1, disabled: 0 },
})
const off = provider(3, { name: '备用代理', enabled: false })

describe('the list', () => {
  it('names the state of a provider', () => {
    expect([fine, broken, off].map(stateOf)).toEqual(['fine', 'suspended', 'off'])
  })

  it('narrows by name, address and state', () => {
    const all = [fine, broken, off]
    expect(matching(all, { query: 'open', state: undefined })).toEqual([fine, broken])
    expect(matching(all, { query: 'OPENROUTER.AI', state: undefined })).toEqual([broken])
    expect(matching(all, { query: '', state: 'off' })).toEqual([off])
    expect(matching(all, { query: 'open', state: 'suspended' })).toEqual([broken])
  })

  it('writes the filter into the address', () => {
    expect(searchOf({ query: '', state: undefined })).toBe('')
    expect(searchOf({ query: 'open', state: 'off' })).toBe('?q=open&state=off')
  })
})

describe('a new provider', () => {
  it('takes its name, kind and address from a preset', () => {
    const preset = {
      id: 'openrouter',
      name: 'OpenRouter',
      kind: 'compatible' as const,
      base_url: 'https://openrouter.ai/api/v1',
      doc_url: null,
      models: 300,
    }
    expect(withPreset({ ...blankDraft, apiKey: 'sk-kept' }, preset)).toEqual({
      presetId: 'openrouter',
      name: 'OpenRouter',
      kind: 'compatible',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-kept',
      priceMultiplier: 1,
    })
    expect(withPreset({ ...blankDraft, presetId: 'openrouter', name: 'Mine' }, undefined)).toEqual({
      ...blankDraft,
      name: 'Mine',
    })
  })
})

describe('settingsChanges', () => {
  it('sends what was edited and a key only when one was typed', () => {
    const draft = settingsOf(broken)
    expect(settingsChanges(broken, draft)).toEqual({})
    expect(
      settingsChanges(broken, {
        ...draft,
        name: ' Router ',
        apiKey: 'sk-new',
        priceMultiplier: 1.2,
      }),
    ).toEqual({ name: 'Router', apiKey: 'sk-new', priceMultiplier: 1.2 })
    expect(settingsChanges(broken, { ...draft, baseUrl: '' })).toEqual({ baseUrl: '' })
  })
})

describe('discovered models', () => {
  it('says what adding one would do', () => {
    expect(placementOf(discovered('a', { route_id: 4, model_id: 2 }))).toBe('added')
    expect(placementOf(discovered('b', { model_id: 2 }))).toBe('joins')
    expect(placementOf(discovered('c'))).toBe('creates')
  })

  it('searches names and upstream identifiers', () => {
    const models = [discovered('openai/gpt-5-mini', { name: 'GPT-5 Mini' }), discovered('claude')]
    expect(discoveredMatching(models, ' mini ')).toEqual([models[0]])
    expect(discoveredMatching(models, 'CLAUDE')).toEqual([models[1]])
    expect(discoveredMatching(models, '')).toEqual(models)
  })
})
