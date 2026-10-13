import { describe, expect, it } from 'vitest'
import {
  adaptationOf,
  fromSourceChoice,
  narrowed,
  sceneChoice,
  searchOf,
  shortCall,
  sourceChoice,
  type Narrowing,
} from './admin-ai-request'

const every: Narrowing = {
  range: '24h',
  source: undefined,
  scene: undefined,
  modelId: undefined,
  providerId: undefined,
  result: undefined,
  errorKind: undefined,
}

describe('the address of the log', () => {
  it('always names the range and adds what narrows the list', () => {
    expect(searchOf(every)).toBe('?range=24h')
    expect(
      searchOf({
        ...every,
        range: '7d',
        source: 'scene',
        scene: 'moderation_review',
        modelId: 2,
        result: 'failed',
        errorKind: 'quota',
      }),
    ).toBe('?range=7d&source=scene&scene=moderation_review&model=2&result=failed&error=quota')
  })

  it('knows whether anything narrows the list', () => {
    expect(narrowed(every)).toBe(false)
    expect(narrowed({ ...every, range: '30d' })).toBe(false)
    expect(narrowed({ ...every, providerId: 1 })).toBe(true)
  })
})

describe('the source filter', () => {
  it('offers each scene as its own choice', () => {
    expect(sourceChoice(every)).toBe('all')
    expect(sourceChoice({ source: 'check', scene: undefined })).toBe('check')
    expect(sourceChoice({ source: 'scene', scene: 'moderation_review' })).toBe(
      sceneChoice('moderation_review'),
    )
  })

  it('turns a choice back into the filter', () => {
    expect(fromSourceChoice(sceneChoice('moderation_review'))).toEqual({
      source: 'scene',
      scene: 'moderation_review',
    })
    expect(fromSourceChoice('playground')).toEqual({ source: 'playground', scene: undefined })
    expect(fromSourceChoice('all')).toEqual({ source: undefined, scene: undefined })
  })
})

describe('adaptationOf', () => {
  it('reads what the gateway changed before the attempt', () => {
    expect(adaptationOf('protocol:responses')).toEqual({ kind: 'protocol', protocol: 'responses' })
    expect(adaptationOf('drop:temperature')).toEqual({ kind: 'drop', param: 'temperature' })
    expect(adaptationOf('json_mode')).toEqual({ kind: 'json_mode' })
    expect(adaptationOf(null)).toBeUndefined()
    expect(adaptationOf('something:else')).toBeUndefined()
  })
})

describe('shortCall', () => {
  it('shows the start of the call number', () => {
    expect(shortCall({ call_id: '3f9a2c41-77aa-4c1e-9d0b-1f2e3d4c5b6a' })).toBe('3f9a2c41')
  })
})
