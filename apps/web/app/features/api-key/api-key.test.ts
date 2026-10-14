import { describe, expect, it } from 'vitest'
import { canCreate } from './api-key'

describe('canCreate', () => {
  it('allows a key below the limit while the API is open', () => {
    expect(canCreate({ keys: [], limit: 10, enabled: true })).toBe(true)
    expect(canCreate({ keys: [], limit: 10, enabled: false })).toBe(false)
  })

  it('stops at the limit', () => {
    const key = {
      id: 1,
      name: 'k',
      prefix: 'shl_abcdefgh',
      status: 'active' as const,
      suspended_reason: null,
      suspended_at: null,
      last_used_at: null,
      created: '2026-10-14T00:00:00Z',
    }
    expect(canCreate({ keys: [key], limit: 1, enabled: true })).toBe(false)
  })
})
