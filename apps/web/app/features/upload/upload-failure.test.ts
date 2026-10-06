import { describe, expect, it } from 'vitest'
import { ApiError } from '~/shared/api/error'
import { BusinessCode } from '~/shared/api/generated/business-codes'
import type { BusinessCodeName } from '~/shared/api/types'
import { backoff, decide, stalledConnection, stopped } from './upload-failure'

function apiError(status: number, name: BusinessCodeName, retryAfter?: number) {
  return new ApiError(
    status,
    {
      code: BusinessCode[name],
      message: name,
      data: { errors: null },
      requestId: '',
      timestamp: '',
    },
    retryAfter,
  )
}

describe('decide', () => {
  it('stops when the upload is paused or cancelled', () => {
    expect(decide(stopped(), 0, 0)).toEqual({ kind: 'stop' })
  })

  it('retries network trouble, stalls and server errors', () => {
    expect(decide(new TypeError('offline'), 0, 0)).toMatchObject({
      kind: 'retry',
      reason: 'network',
    })
    expect(decide(stalledConnection(), 3, 0)).toMatchObject({ kind: 'retry', reason: 'network' })
    expect(decide(apiError(502, 'AUTH_FORBIDDEN'), 0, 0)).toMatchObject({ kind: 'retry' })
    expect(decide(apiError(429, 'AUTH_FORBIDDEN', 7), 0, 0)).toEqual({
      kind: 'retry',
      reason: 'network',
      delay: 7000,
    })
  })

  it('waits while the server is busy or the session is gone', () => {
    expect(decide(apiError(503, 'UPLOAD_SPOOL_FULL'), 0, 0)).toMatchObject({ reason: 'busy' })
    expect(decide(apiError(409, 'USER_UPLOAD_IN_FLIGHT_EXCEEDED'), 0, 0)).toMatchObject({
      reason: 'busy',
    })
    expect(decide(apiError(401, 'AUTH_UNAUTHORIZED'), 0, 0)).toMatchObject({ reason: 'signedOut' })
  })

  it('fails when the file is not the one being uploaded', () => {
    expect(decide(apiError(409, 'GAME_UPLOAD_CHUNK_SHA256_MISMATCH'), 0, 0)).toMatchObject({
      kind: 'retry',
    })
    expect(decide(apiError(409, 'GAME_UPLOAD_CHUNK_SHA256_MISMATCH'), 2, 0)).toEqual({
      kind: 'fail',
      reason: 'changedFile',
    })
    expect(decide(apiError(409, 'GAME_UPLOAD_FILE_BLAKE3_MISMATCH'), 0, 0)).toEqual({
      kind: 'fail',
      reason: 'differentFile',
    })
    expect(decide(apiError(410, 'GAME_UPLOAD_SESSION_EXPIRED'), 0, 0)).toEqual({
      kind: 'fail',
      reason: 'expired',
    })
    expect(decide(apiError(400, 'GAME_UPLOAD_TOO_LARGE'), 0, 0)).toMatchObject({
      kind: 'fail',
      reason: 'rejected',
    })
  })
})

describe('backoff', () => {
  it('grows, stays capped and keeps at least half of its step', () => {
    expect(backoff(0, 0)).toBe(500)
    expect(backoff(3, 1)).toBe(8000)
    expect(backoff(20, 1)).toBe(60_000)
  })
})
