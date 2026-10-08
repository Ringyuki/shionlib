import { toast } from '@hina-ui/react'
import { isRouteErrorResponse } from 'react-router'
import { useTranslations } from 'use-intl'
import { fieldMessages } from '~/shared/api/error'
import { isFailure } from '~/shared/api/failure.schema'
import type { ApiFailure } from '~/shared/api/types'
import { unwrapped } from './refusal.schema'

export type Refused = {
  ok: false
  failure: ApiFailure
  retryAfter: number | undefined
  status: number
}

export type Outcome<Result> = { ok: true; result: Result } | Refused

const unreachableCode = -1

const traceableFor = 10_000

export class Refusal extends Error {
  readonly failure: ApiFailure

  constructor(failure: ApiFailure) {
    super(failure.message)
    this.name = 'Refusal'
    this.failure = failure
  }
}

export function refusalOf(thrown: unknown): Refused {
  const error = unwrapped(thrown)
  if (isRouteErrorResponse(error) && isFailure(error.data)) {
    return { ok: false, failure: error.data, retryAfter: undefined, status: error.status }
  }
  const failure = {
    code: unreachableCode,
    message: describe(error),
    data: { errors: null },
    requestId: '',
    timestamp: '',
  }
  return { ok: false, failure, retryAfter: undefined, status: 0 }
}

export function describe(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return isRouteErrorResponse(error) ? `${error.status} ${error.statusText}`.trim() : String(error)
}

export function useRefusalNotice() {
  const t = useTranslations('site')
  return ({ failure, retryAfter, status }: Refused) => {
    if (Object.keys(fieldMessages(failure)).length > 0) {
      return
    }
    const unanswered = failure.code === unreachableCode
    const message = unanswered ? t('errorDescription') : failure.message
    const text =
      retryAfter === undefined ? message : t('retryAfter', { message, seconds: retryAfter })
    if (status >= 500 && failure.requestId !== '') {
      toast.danger(text, {
        id: text,
        description: t('requestId', { id: failure.requestId }),
        duration: traceableFor,
        action: {
          label: t('copy'),
          onClick: () => void navigator.clipboard.writeText(failure.requestId),
        },
      })
      return
    }
    toast.danger(text, { id: text, description: unanswered ? failure.message : undefined })
  }
}
