import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { rangeFrom, sceneCommand } from './admin-ai.schema'

describe('rangeFrom', () => {
  it('falls back to a day', () => {
    expect(rangeFrom('7d')).toBe('7d')
    expect(rangeFrom(null)).toBe('24h')
    expect(rangeFrom('1y')).toBe('24h')
  })
})

describe('sceneCommand', () => {
  it('takes a scene with or without its own model and parameters', () => {
    const follow = {
      key: 'moderation_review',
      modelId: null,
      temperature: null,
      maxOutputTokens: null,
      timeoutSeconds: 30,
    }
    expect(parseOptional(sceneCommand, follow)).toEqual(follow)
    expect(parseOptional(sceneCommand, { ...follow, modelId: 0 })).toBeUndefined()
    expect(parseOptional(sceneCommand, { key: 'moderation_review' })).toBeUndefined()
  })
})
