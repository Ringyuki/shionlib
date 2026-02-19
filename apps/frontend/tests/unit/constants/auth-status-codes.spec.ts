import { describe, expect, it } from 'vitest'
import {
  IS_FATAL_AUTH_BY_CODES,
  SHOULD_REFRESH_CODES,
} from '../../../constants/auth/auth-status-codes'

describe('constants/auth/auth-status-codes (unit)', () => {
  it('defines refresh and fatal auth code sets', () => {
    expect(SHOULD_REFRESH_CODES).toEqual(expect.arrayContaining([200101, 200102]))
    expect(IS_FATAL_AUTH_BY_CODES).toEqual(
      expect.arrayContaining([200103, 200104, 200105, 200106, 300105]),
    )
  })
})
