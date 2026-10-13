import { describe, expect, it } from 'vitest'
import { grantsBadge, offered, searchOf, sponsorOf } from './admin-sponsor'

const member = { id: 2, name: 'e2e_user', avatar: 'user/2/avatar.webp', is_sponsor: false }

describe('searchOf', () => {
  it('names a status and leaves every order out of the address', () => {
    expect(searchOf({ status: undefined })).toBe('')
    expect(searchOf({ status: 'REFUND' })).toBe('?status=REFUND')
  })
})

describe('offered', () => {
  it('offers the outcomes an order does not have yet', () => {
    expect(offered({ status: 'NEW' })).toEqual(['DONE', 'REFUND'])
    expect(offered({ status: 'EXPIRED' })).toEqual(['DONE', 'REFUND'])
    expect(offered({ status: 'DONE' })).toEqual(['REFUND'])
    expect(offered({ status: 'REFUND' })).toEqual(['DONE'])
  })
})

describe('sponsorOf', () => {
  it('prefers the account, then the name that was given', () => {
    expect(sponsorOf({ user: member, sponsorName: 'Alice' })).toEqual({
      name: 'e2e_user',
      avatar: 'user/2/avatar.webp',
    })
    expect(sponsorOf({ user: null, sponsorName: ' Alice ' })).toEqual({
      name: 'Alice',
      avatar: null,
    })
  })

  it('leaves an order without either nameless', () => {
    expect(sponsorOf({ user: null, sponsorName: null }).name).toBeUndefined()
    expect(sponsorOf({ user: null, sponsorName: '  ' }).name).toBeUndefined()
  })
})

describe('grantsBadge', () => {
  it('holds only for an account whose order was not completed before', () => {
    expect(grantsBadge({ user: member, status: 'NEW' })).toBe(true)
    expect(grantsBadge({ user: member, status: 'REFUND' })).toBe(true)
    expect(grantsBadge({ user: member, status: 'DONE' })).toBe(false)
    expect(grantsBadge({ user: null, status: 'NEW' })).toBe(false)
  })
})
