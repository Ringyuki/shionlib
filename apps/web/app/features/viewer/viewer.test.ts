import { describe, expect, it } from 'vitest'
import { contentLimits, isStaff, isSuperAdmin, showsExplicit } from './viewer'

describe('showsExplicit', () => {
  it('is true only for a viewer who chose to see everything', () => {
    expect(contentLimits.filter(limit => showsExplicit({ content_limit: limit }))).toEqual([3])
    expect(showsExplicit(null)).toBe(false)
  })
})

describe('roles', () => {
  it('counts admins and super admins as staff, and only the latter as super admins', () => {
    expect([1, 2, 3].map(role => isStaff({ role }))).toEqual([false, true, true])
    expect([1, 2, 3].map(role => isSuperAdmin({ role }))).toEqual([false, false, true])
    expect(isStaff(null)).toBe(false)
    expect(isSuperAdmin(null)).toBe(false)
  })
})
