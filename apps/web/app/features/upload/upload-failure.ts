import { ApiError } from '~/shared/api/error'
import { FileReadError } from './file-hasher'
import type { FailureReason, WaitReason } from './upload'
import {
  describeError,
  type ErrorReport,
  type FailureOrigin,
  type FailureStage,
} from './upload-report'
import { sleep } from './upload-slots'

export type Decision =
  | { kind: 'stop' }
  | { kind: 'yield' }
  | { kind: 'retry'; reason: WaitReason; delay: number }
  | { kind: 'fail'; reason: FailureReason; message?: string }

const retryBase = 1_000

const retryCap = 60_000

const busyDelay = 30_000

const changedFileAttempts = 2

type Place = { stage?: FailureStage; chunk?: number }

export class UploadFailure extends Error {
  readonly reason: FailureReason
  readonly detail: string | undefined
  readonly origin: ErrorReport
  readonly place: Place

  constructor(
    reason: FailureReason,
    detail: string | undefined,
    origin: ErrorReport,
    place: Place = {},
  ) {
    super(detail ?? reason)
    this.reason = reason
    this.detail = detail
    this.origin = origin
    this.place = place
  }

  at(stage: FailureStage, chunk?: number): UploadFailure {
    return this.place.stage === undefined
      ? new UploadFailure(this.reason, this.detail, this.origin, { stage, chunk })
      : this
  }

  originOf(fallback: FailureStage): FailureOrigin {
    return {
      reason: this.reason,
      error: this.origin,
      stage: this.place.stage ?? fallback,
      ...(this.place.chunk === undefined ? {} : { chunk: this.place.chunk }),
    }
  }
}

export class HeldElsewhere extends Error {}

export type Waiting = {
  wait: (reason: WaitReason, error: unknown) => void
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
      if (decision.kind === 'yield') {
        throw new HeldElsewhere()
      }
      if (decision.kind === 'fail') {
        throw new UploadFailure(decision.reason, decision.message, describeError(error))
      }
      waiting.wait(decision.reason, error)
      await sleep(decision.delay, scope)
      waiting.resume()
    }
  }
}

export function failureOf(error: unknown): UploadFailure | undefined {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return undefined
  }
  return error instanceof UploadFailure
    ? error
    : new UploadFailure('rejected', undefined, describeError(error))
}

export function locate(error: unknown, stage: FailureStage, chunk?: number): unknown {
  if (error instanceof FileReadError) {
    return new UploadFailure('unreadable', undefined, describeError(error), {
      stage: 'read',
      chunk,
    })
  }
  return error instanceof UploadFailure ? error.at(stage, chunk) : error
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
  if (error.is('GAME_UPLOAD_SESSION_HELD_ELSEWHERE')) {
    return { kind: 'yield' }
  }
  if (error.is('UPLOAD_SPOOL_FULL')) {
    return { kind: 'retry', reason: 'busy', delay: busyDelay }
  }
  if (error.is('USER_UPLOAD_IN_FLIGHT_EXCEEDED')) {
    return { kind: 'retry', reason: 'inFlight', delay: busyDelay }
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
  return {
    kind: 'fail',
    reason: 'rejected',
    ...(error.message === '' ? {} : { message: error.message }),
  }
}

export function backoff(attempt: number, random: number): number {
  const ceiling = Math.min(retryCap, retryBase * 2 ** attempt)
  return Math.round(ceiling * (0.5 + random / 2))
}
