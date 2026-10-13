import { describe, expect, it } from 'vitest'
import {
  aiPaths,
  errorKindOf,
  errorTone,
  failureRate,
  healthOf,
  hostOf,
  protocolName,
  sceneLabel,
  tokenCount,
} from './admin-ai'

describe('aiPaths', () => {
  it('keeps every tab under the gateway and opens one request on the log', () => {
    expect(aiPaths.overview).toBe('/zh/admin/ai')
    expect(aiPaths.provider(3)).toBe('/zh/admin/ai/providers/3')
    expect(aiPaths.model(7)).toBe('/zh/admin/ai/models/7')
    expect(aiPaths.request('310', '7d')).toBe('/zh/admin/ai/requests?range=7d&id=310')
  })
})

describe('failureRate', () => {
  it('is unknown without requests', () => {
    expect(failureRate({ requests: 0, failures: 0 })).toBeUndefined()
    expect(failureRate({ requests: 200, failures: 3 })).toBeCloseTo(0.015)
  })
})

describe('protocolName', () => {
  it('names the protocols it knows and passes others through', () => {
    expect(protocolName('chat')).toBe('Chat Completions')
    expect(protocolName('moderation')).toBe('Moderations')
    expect(protocolName('future')).toBe('future')
  })
})

describe('hostOf', () => {
  it('drops the scheme and the trailing slash', () => {
    expect(hostOf({ kind: 'compatible', base_url: 'https://openrouter.ai/api/v1/' })).toBe(
      'openrouter.ai/api/v1',
    )
  })

  it('names the official host when no address was set', () => {
    expect(hostOf({ kind: 'openai', base_url: null })).toBe('api.openai.com')
    expect(hostOf({ kind: 'anthropic', base_url: '' })).toBe('api.anthropic.com')
  })
})

describe('error kinds', () => {
  it('treats what it does not know as another error', () => {
    expect(errorKindOf('quota')).toBe('quota')
    expect(errorKindOf('')).toBe('other')
    expect(errorKindOf('brand_new')).toBe('other')
  })

  it('warns about what passes by itself and alarms about the rest', () => {
    expect(errorTone('timeout')).toBe('warning')
    expect(errorTone('rate_limit')).toBe('warning')
    expect(errorTone('quota')).toBe('danger')
    expect(errorTone('auth')).toBe('danger')
  })
})

describe('tokenCount', () => {
  it('shortens thousands and millions', () => {
    expect(tokenCount(512)).toBe('512')
    expect(tokenCount(128_000)).toBe('128K')
    expect(tokenCount(400_000)).toBe('400K')
    expect(tokenCount(1_000_000)).toBe('1M')
    expect(tokenCount(1_048_576)).toBe('1M')
    expect(tokenCount(2_500_000)).toBe('2.5M')
  })
})

describe('healthOf', () => {
  const counts = { total: 3, active: 2, suspended: 1, disabled: 0 }

  it('reports the worst state first', () => {
    expect(healthOf(true, { total: 0, active: 0, suspended: 0, disabled: 0 })).toEqual({
      state: 'empty',
    })
    expect(healthOf(false, counts)).toEqual({ state: 'off', total: 3 })
    expect(healthOf(true, counts)).toEqual({ state: 'suspended', suspended: 1, total: 3 })
    expect(healthOf(true, { total: 3, active: 2, suspended: 0, disabled: 1 })).toEqual({
      state: 'fine',
      active: 2,
      total: 3,
    })
  })
})

describe('sceneLabel', () => {
  const scenes = [{ key: 'moderation_review', label: '内容审核复审' }]

  it('names the scene of a scene request only', () => {
    expect(sceneLabel({ source: 'scene', scene: 'moderation_review' }, scenes)).toBe('内容审核复审')
    expect(sceneLabel({ source: 'scene', scene: 'removed' }, scenes)).toBe('removed')
    expect(sceneLabel({ source: 'check', scene: null }, scenes)).toBeUndefined()
  })
})
