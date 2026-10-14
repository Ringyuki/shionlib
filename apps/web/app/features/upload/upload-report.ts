import { constraints } from '~/shared/api/generated/constraints'
import { ApiError } from '~/shared/api/error'
import type { Schema } from '~/shared/api/types'
import type { FailureReason, Upload, WaitReason } from './upload'

export type ErrorReport = Schema<'ClientErrorInput'>

export type FailureAttempt = Schema<'FailureAttemptInput'>

export type FailureReport = Schema<'ReportFailureInputBody'>

export type FailureStage = FailureReport['stage']

export type FailureOrigin = {
  reason: FailureReason
  error: ErrorReport
  stage: FailureStage
  chunk?: number
}

const errorFields = constraints.ClientErrorInput

const mostAttempts = constraints.ReportFailureInputBody.attempts.maxItems

const reasonNames: Readonly<Record<FailureReason, FailureReport['reason']>> = {
  differentFile: 'different_file',
  changedFile: 'changed_file',
  unreadable: 'unreadable',
  expired: 'expired',
  rejected: 'rejected',
}

const waitNames: Readonly<Partial<Record<WaitReason, FailureAttempt['wait']>>> = {
  network: 'network',
  busy: 'busy',
  inFlight: 'in_flight',
  signedOut: 'signed_out',
}

export function describeError(error: unknown): ErrorReport {
  if (error instanceof ApiError) {
    const requestId = error.failure.requestId
    return {
      name: 'ApiError',
      message: error.message.slice(0, errorFields.message.maxLength),
      status: error.status,
      code: error.code,
      ...(requestId === ''
        ? {}
        : { request_id: requestId.slice(0, errorFields.request_id.maxLength) }),
      ...(error.ray === undefined ? {} : { ray: error.ray.slice(0, errorFields.ray.maxLength) }),
    }
  }
  if (error instanceof Error) {
    return {
      name: error.name.slice(0, errorFields.name.maxLength),
      message: error.message.slice(0, errorFields.message.maxLength),
    }
  }
  return { name: 'Unknown', message: String(error).slice(0, errorFields.message.maxLength) }
}

export function remembered(
  attempts: readonly FailureAttempt[],
  reason: WaitReason,
  error: unknown,
  at: number,
): FailureAttempt[] {
  const wait = waitNames[reason]
  if (wait === undefined) {
    return [...attempts]
  }
  const attempt = { at: new Date(at).toISOString(), wait, error: describeError(error) }
  return [...attempts, attempt].slice(-mostAttempts)
}

export function uploadReport(
  upload: Upload,
  origin: FailureOrigin,
  attempts: readonly FailureAttempt[],
): FailureReport {
  return {
    ...(upload.session === undefined ? {} : { session_id: upload.session.id }),
    stage: origin.stage,
    reason: reasonNames[origin.reason],
    error: origin.error,
    ...(origin.chunk === undefined ? {} : { chunk: origin.chunk }),
    file_name: upload.file.name,
    file_size: upload.file.size,
    ...(attempts.length === 0 ? {} : { attempts: [...attempts] }),
  }
}

export function submissionReport(
  label: string,
  uploads: readonly Upload[],
  error: unknown,
): FailureReport {
  return {
    stage: 'submit',
    reason: 'rejected',
    error: describeError(error),
    file_name: label,
    file_size: uploads.reduce((total, upload) => total + upload.file.size, 0),
  }
}
