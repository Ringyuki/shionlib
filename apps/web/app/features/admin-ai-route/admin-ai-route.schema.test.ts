import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { routeCommand } from './admin-ai-route.schema'

describe('routeCommand', () => {
  it('reads each kind of change', () => {
    expect(parseOptional(routeCommand, { action: 'check', id: 3 })).toEqual({
      action: 'check',
      id: 3,
    })
    expect(
      parseOptional(routeCommand, { action: 'update', id: 3, changes: { protocol: 'responses' } }),
    ).toMatchObject({ changes: { protocol: 'responses' } })
    expect(
      parseOptional(routeCommand, { action: 'batch', ids: [1, 2], operation: 'disable' }),
    ).toMatchObject({ ids: [1, 2] })
  })

  it('refuses what the API would not take', () => {
    expect(parseOptional(routeCommand, { action: 'batch', ids: [], operation: 'delete' })).toBe(
      undefined,
    )
    expect(
      parseOptional(routeCommand, { action: 'update', id: 3, changes: { status: 'suspended' } }),
    ).toBeUndefined()
    expect(parseOptional(routeCommand, { action: 'revert', id: 3 })).toBeUndefined()
  })
})
