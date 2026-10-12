import { describe, expect, it } from 'vitest'
import { bangumiState, hitState, numbered, searchStateOf, spanOf, stateOf } from './admin-catalog'

describe('stateOf', () => {
  it('puts a failure before the last pull', () => {
    const pulled = '2026-10-12T11:00:00.000Z'
    expect(stateOf({ incremental: true, pulled_at: pulled, failed_at: null })).toBe('fine')
    expect(stateOf({ incremental: true, pulled_at: pulled, failed_at: pulled })).toBe('failed')
    expect(stateOf({ incremental: true, pulled_at: null, failed_at: null })).toBe('never')
    expect(stateOf({ incremental: false, pulled_at: null, failed_at: pulled })).toBe('manual')
  })
})

describe('spanOf', () => {
  it('names a duration by its largest whole unit', () => {
    expect(spanOf(7 * 24 * 60 * 60)).toEqual({ unit: 'day', count: 7 })
    expect(spanOf(36 * 60 * 60)).toEqual({ unit: 'hour', count: 36 })
    expect(spanOf(90 * 60)).toEqual({ unit: 'minute', count: 90 })
    expect(spanOf(60 * 60)).toEqual({ unit: 'hour', count: 1 })
  })
})

describe('hitState', () => {
  it('tells what an import would do', () => {
    expect(hitState({ local_id: null, excluded: false })).toBe('absent')
    expect(hitState({ local_id: 12, excluded: false })).toBe('here')
    expect(hitState({ local_id: null, excluded: true })).toBe('excluded')
  })
})

describe('numbered', () => {
  it('knows an entry that is offered by its number alone', () => {
    expect(numbered({ title: '' })).toBe(true)
    expect(numbered({ title: 'サクラノ刻' })).toBe(false)
  })
})

describe('searchStateOf', () => {
  it('waits before it reports a failure or the results', () => {
    expect(searchStateOf({ query: '', waiting: false, failed: true })).toBe('idle')
    expect(searchStateOf({ query: 'a', waiting: true, failed: true })).toBe('searching')
    expect(searchStateOf({ query: 'a', waiting: false, failed: true })).toBe('failed')
    expect(searchStateOf({ query: 'a', waiting: false, failed: false })).toBe('done')
  })
})

describe('bangumiState', () => {
  it('asks for the application before the authorization', () => {
    expect(bangumiState({ configured: false, authorized: false })).toBe('unset')
    expect(bangumiState({ configured: true, authorized: false })).toBe('pending')
    expect(bangumiState({ configured: true, authorized: true })).toBe('authorized')
  })
})
