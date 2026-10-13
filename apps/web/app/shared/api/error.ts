import { isFailure, retryAfterFrom } from './failure.schema'
import { BusinessCode } from './generated/business-codes'
import type { ApiFailure, BusinessCodeName } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly failure: ApiFailure
  readonly retryAfter: number | undefined

  constructor(status: number, failure: ApiFailure, retryAfter?: number) {
    super(failure.message)
    this.name = 'ApiError'
    this.status = status
    this.failure = failure
    this.retryAfter = retryAfter
  }

  get code(): number {
    return this.failure.code
  }

  is(name: BusinessCodeName): boolean {
    return this.failure.code === BusinessCode[name]
  }

  static fromResponse(response: Response, body: unknown): ApiError {
    return new ApiError(
      response.status,
      isFailure(body) ? body : syntheticFailure(response),
      retryAfterFrom(response.headers.get('retry-after')),
    )
  }
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
