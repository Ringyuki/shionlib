import { toast } from '@hina-ui/react'
import { isRouteErrorResponse } from 'react-router'
import { useTranslations } from 'use-intl'
import { ApiError, fieldMessages } from '~/shared/api/error'
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

export function refusedOf<Result>(outcome: Outcome<Result> | undefined): Refused | undefined {
  return outcome?.ok === false ? outcome : undefined
}

export function namesFields(refused: Refused): boolean {
  return Object.keys(fieldMessages(refused.failure)).length > 0
}

export function refusalFrom(thrown: unknown): Refused {
  if (thrown instanceof ApiError) {
    return {
      ok: false,
      failure: thrown.failure,
      retryAfter: thrown.retryAfter,
      status: thrown.status,
    }
  }
  return refusalOf(thrown)
}

function usePhrase() {
  const t = useTranslations('site')
  return ({ failure, retryAfter }: Refused) => {
    const message = failure.code === unreachableCode ? t('errorDescription') : failure.message
    return retryAfter === undefined ? message : t('retryAfter', { message, seconds: retryAfter })
  }
}

export function useRefusalText() {
  const t = useTranslations('site')
  const phrase = usePhrase()
  return (refused: Refused): string => {
    const { failure, status } = refused
    if (failure.code === unreachableCode) {
      return `${phrase(refused)}（${failure.message}）`
    }
    const traceable = status >= 500 && failure.requestId !== ''
    const text = phrase(refused)
    return traceable ? `${text}（${t('requestId', { id: failure.requestId })}）` : text
  }
}

export function useRefusalNotice() {
  const t = useTranslations('site')
  const phrase = usePhrase()
  return (refused: Refused) => {
    const { failure, status } = refused
    if (namesFields(refused)) {
      return
    }
    const unanswered = failure.code === unreachableCode
    const text = phrase(refused)
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
