import { BusinessCode } from './generated/business-codes'
import type { ApiFailure, BusinessCodeName } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly failure: ApiFailure

  constructor(status: number, failure: ApiFailure) {
    super(failure.message)
    this.name = 'ApiError'
    this.status = status
    this.failure = failure
  }

  get code(): number {
    return this.failure.code
  }

  is(name: BusinessCodeName): boolean {
    return this.failure.code === BusinessCode[name]
  }

  static fromResponse(response: Response, body: unknown): ApiError {
    return new ApiError(response.status, isFailure(body) ? body : syntheticFailure(response))
  }
}

export function isFailure(value: unknown): value is ApiFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'number' &&
    value.code !== 0 &&
    'message' in value &&
    typeof value.message === 'string'
  )
}

function syntheticFailure(response: Response): ApiFailure {
  return {
    code: response.status,
    message: response.statusText,
    data: { errors: null },
    requestId: response.headers.get('shionlib-request-id') ?? '',
    timestamp: new Date().toISOString(),
  }
}

export function fieldMessages(failure: ApiFailure): Record<string, string> {
  const messages: Record<string, string> = {}
  for (const field of failure.data?.errors ?? []) {
    const first = field.messages?.[0]
    if (first !== undefined) {
      messages[field.field] = first
    }
  }
  return messages
}
