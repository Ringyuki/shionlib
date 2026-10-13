import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import {
  contentLimitFrom,
  filterFrom,
  languageFrom,
  roleFrom,
  userCommand,
} from './admin-user.schema'

describe('filterFrom', () => {
  it('reads the filters and ignores what it does not know', () => {
    expect(filterFrom(new URLSearchParams('q=%20kotori%20&role=3&status=1&sort=name'), 4)).toEqual({
      query: 'kotori',
      role: 3,
      status: 1,
      sort: 'name',
      page: 4,
    })
    expect(filterFrom(new URLSearchParams('role=9&status=x&sort=email'), 1)).toEqual({
      query: '',
      role: undefined,
      status: undefined,
      sort: 'last_login_at',
      page: 1,
    })
  })
})

describe('guards', () => {
  it('accept only known roles, limits and languages', () => {
    expect(roleFrom(2)).toBe(2)
    expect(roleFrom(4)).toBeUndefined()
    expect(contentLimitFrom(3)).toBe(3)
    expect(contentLimitFrom(0)).toBeUndefined()
    expect(languageFrom('ja')).toBe('ja')
    expect(languageFrom('fr')).toBeUndefined()
  })

  it('read a change by its action', () => {
    expect(parseOptional(userCommand, { action: 'trust', id: 7, trusted: true })).toEqual({
      action: 'trust',
      id: 7,
      trusted: true,
    })
    expect(
      parseOptional(userCommand, { action: 'ban', id: 7, days: 0, reason: 'x' }),
    ).toBeUndefined()
    expect(parseOptional(userCommand, { action: 'erase', id: 7 })).toBeUndefined()
  })
})
