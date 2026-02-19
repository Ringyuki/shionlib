import { describe, expect, it } from 'vitest'
import { HASH_STEP_BYTES } from '../../../../libs/uploader/constants/constant'

describe('libs/uploader/constants/constant (unit)', () => {
  it('uses 16MB hashing step size', () => {
    expect(HASH_STEP_BYTES).toBe(1024 * 1024 * 16)
  })
})
