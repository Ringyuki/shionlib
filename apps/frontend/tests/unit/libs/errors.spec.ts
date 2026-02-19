import { describe, expect, it } from 'vitest'
import {
  ShionlibBizError,
  createPublicErrorDigest,
  parsePublicErrorDigest,
} from '../../../libs/errors'

describe('libs/errors (unit)', () => {
  it('creates error with code and normalized message', () => {
    const err = new ShionlibBizError(200101, 'Unauthorized')

    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ShionlibBizError')
    expect(err.code).toBe(200101)
    expect(err.message).toBe('Unauthorized(200101)')
    expect(err.digest).toBe(createPublicErrorDigest(200101, 'Unauthorized'))
  })

  it('parses public error digest payload', () => {
    const digest = createPublicErrorDigest(200200, 'Permission denied')
    const parsed = parsePublicErrorDigest(digest)

    expect(parsed).toEqual({ code: 200200, message: 'Permission denied' })
  })

  it('returns undefined for unknown digest format', () => {
    expect(parsePublicErrorDigest('random-digest')).toBeUndefined()
  })
})
