import { ApiError } from '~/shared/api/error'
import type { FailureReason, WaitReason } from './upload'
import { sleep } from './upload-slots'

export type Decision =
  | { kind: 'stop' }
  | { kind: 'retry'; reason: WaitReason; delay: number }
  | { kind: 'fail'; reason: FailureReason; message?: string }

const retryBase = 1_000

const retryCap = 60_000

const busyDelay = 30_000

const changedFileAttempts = 2

export class UploadFailure extends Error {
  readonly reason: FailureReason
  readonly detail: string | undefined

  constructor(reason: FailureReason, detail?: string) {
    super(detail ?? reason)
    this.reason = reason
    this.detail = detail
  }
}

export type Waiting = {
  wait: (reason: WaitReason) => void
  resume: () => void
  random: () => number
}

export async function retrying<Result>(
  scope: AbortSignal,
  attempt: () => Promise<Result>,
  waiting: Waiting,
): Promise<Result> {
  for (let tries = 0; ; tries++) {
    scope.throwIfAborted()
    try {
      return await attempt()
    } catch (error) {
      if (scope.aborted) {
        throw scope.reason
      }
      const decision = decide(error, tries, waiting.random())
      if (decision.kind === 'stop') {
        throw error
      }
      if (decision.kind === 'fail') {
        throw new UploadFailure(decision.reason, decision.message)
      }
      waiting.wait(decision.reason)
      await sleep(decision.delay, scope)
      waiting.resume()
    }
  }
}

export function failureOf(error: unknown): UploadFailure | undefined {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return undefined
  }
  return error instanceof UploadFailure ? error : new UploadFailure('rejected', String(error))
}

export function spoilsSession(failure: UploadFailure): boolean {
  return failure.reason === 'differentFile' || failure.reason === 'changedFile'
}

export function stopped(): DOMException {
  return new DOMException('The upload was stopped', 'AbortError')
}

export function stalledConnection(): TypeError {
  return new TypeError('The connection stalled')
}

export function decide(error: unknown, attempt: number, random: number): Decision {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { kind: 'stop' }
  }
  if (!(error instanceof ApiError)) {
    return { kind: 'retry', reason: 'network', delay: backoff(attempt, random) }
  }
  return decideApiError(error, attempt, random)
}

function decideApiError(error: ApiError, attempt: number, random: number): Decision {
  if (error.status === 401) {
    return { kind: 'retry', reason: 'signedOut', delay: retryCap }
  }
  if (error.is('UPLOAD_SPOOL_FULL') || error.is('USER_UPLOAD_IN_FLIGHT_EXCEEDED')) {
    return { kind: 'retry', reason: 'busy', delay: busyDelay }
  }
  if (error.status === 429) {
    const delay =
      error.retryAfter === undefined ? backoff(attempt, random) : error.retryAfter * 1000
    return { kind: 'retry', reason: 'network', delay }
  }
  if (error.status >= 500) {
    return { kind: 'retry', reason: 'network', delay: backoff(attempt, random) }
  }
  if (error.is('GAME_UPLOAD_CHUNK_SHA256_MISMATCH')) {
    return attempt < changedFileAttempts
      ? { kind: 'retry', reason: 'network', delay: retryBase }
      : { kind: 'fail', reason: 'changedFile' }
  }
  if (
    error.is('GAME_UPLOAD_INVALID_CHUNK_SHA256') ||
    error.is('GAME_UPLOAD_FILE_BLAKE3_MISMATCH')
  ) {
    return { kind: 'fail', reason: 'differentFile' }
  }
  if (error.is('GAME_UPLOAD_SESSION_EXPIRED') || error.is('GAME_UPLOAD_SESSION_NOT_FOUND')) {
    return { kind: 'fail', reason: 'expired' }
  }
  return { kind: 'fail', reason: 'rejected', message: error.message }
}

export function backoff(attempt: number, random: number): number {
  const ceiling = Math.min(retryCap, retryBase * 2 ** attempt)
  return Math.round(ceiling * (0.5 + random / 2))
}
