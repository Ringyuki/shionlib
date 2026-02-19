import { describe, expect, it } from 'vitest'
import { ShionlibBizError } from '../../../libs/errors'

describe('libs/errors (unit)', () => {
  it('creates error with code and normalized message', () => {
    const err = new ShionlibBizError(200101, 'Unauthorized')

    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ShionlibBizError')
    expect(err.code).toBe(200101)
    expect(err.message).toBe('Unauthorized(200101)')
  })
})
