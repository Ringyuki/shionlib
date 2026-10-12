import { describe, expect, it } from 'vitest'
import {
  ascending,
  banEnd,
  banned,
  canChangeRole,
  canManage,
  canPunish,
  narrowed,
  nextStep,
  searchOf,
  tierStep,
  type Ladder,
} from './admin-user'

const ladder: Ladder = {
  in_flight_limit: 30,
  tiers: [
    { tier: 'new', after: 0, stored_limit: 50, max_file_size: 30 },
    { tier: 'regular', after: 3, stored_limit: 300, max_file_size: 30 },
    { tier: 'trusted', after: 30, stored_limit: 2000, max_file_size: null },
  ],
}

const member = { id: 7, role: 1 }
const admin = { id: 2, role: 2 }
const owner = { id: 1, role: 3 }

describe('the address of the list', () => {
  it('leaves out what is already the default', () => {
    expect(searchOf({ query: '', role: undefined, status: undefined, sort: 'last_login_at' })).toBe(
      '',
    )
    expect(searchOf({ query: 'kotori', role: 2, status: 2, sort: 'created' })).toBe(
      '?q=kotori&role=2&status=2&sort=created',
    )
  })

  it('sorts names upwards and everything else newest first', () => {
    expect(ascending('name')).toBe(true)
    expect(ascending('last_login_at')).toBe(false)
    expect(narrowed({ query: '', role: undefined, status: undefined })).toBe(false)
    expect(narrowed({ query: '', role: undefined, status: 2 })).toBe(true)
  })
})

describe('who may do what', () => {
  it('lets staff manage those below them, and super administrators everyone', () => {
    expect(canManage(admin, member)).toBe(true)
    expect(canManage(admin, { id: 3, role: 2 })).toBe(false)
    expect(canManage(admin, owner)).toBe(false)
    expect(canManage(owner, { id: 4, role: 3 })).toBe(true)
    expect(canManage(admin, admin)).toBe(true)
  })

  it('never lets anyone ban themselves or reset their own password here', () => {
    expect(canPunish(admin, member)).toBe(true)
    expect(canPunish(admin, admin)).toBe(false)
    expect(canPunish(owner, owner)).toBe(false)
  })

  it('keeps roles to super administrators acting on someone else', () => {
    expect(canChangeRole(owner, member)).toBe(true)
    expect(canChangeRole(owner, owner)).toBe(false)
    expect(canChangeRole(admin, member)).toBe(false)
  })
})

describe('upload tiers', () => {
  it('names the tier an uploader reaches next', () => {
    expect(nextStep(ladder, { approved: 0, trusted: false, tier: 'new' })?.tier).toBe('regular')
    expect(nextStep(ladder, { approved: 12, trusted: false, tier: 'regular' })).toMatchObject({
      tier: 'trusted',
      after: 30,
    })
    expect(nextStep(ladder, { approved: 40, trusted: false, tier: 'trusted' })).toBeUndefined()
    expect(nextStep(ladder, { approved: 1, trusted: true, tier: 'trusted' })).toBeUndefined()
    expect(nextStep(ladder, { approved: 1, trusted: false, tier: 'admin' })).toBeUndefined()
    expect(nextStep({ ...ladder, tiers: null }, { approved: 0, trusted: false, tier: 'new' })).toBe(
      undefined,
    )
  })

  it('reads the limits of a tier', () => {
    expect(tierStep(ladder, 'trusted')).toMatchObject({ stored_limit: 2000, max_file_size: null })
    expect(tierStep({ ...ladder, tiers: null }, 'trusted')).toBeUndefined()
  })
})

describe('bans', () => {
  it('ends after the days it was given, or never', () => {
    const ban = {
      banned_at: '2026-10-12T01:12:00.000Z',
      banned_duration_days: 7,
      is_permanent: false,
    }
    expect(banEnd(ban)?.toISOString()).toBe('2026-10-19T01:12:00.000Z')
    expect(banEnd({ ...ban, is_permanent: true })).toBeUndefined()
    expect(banEnd({ ...ban, banned_duration_days: null })).toBeUndefined()
    expect(banned({ status: 2 })).toBe(true)
    expect(banned({ status: 1 })).toBe(false)
  })
})
