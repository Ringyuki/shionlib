import { toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { fieldMessages } from '~/shared/api/error'
import type { ApiFailure } from '~/shared/api/types'

export type Outcome<Result> =
  { ok: true; result: Result } | { ok: false; failure: ApiFailure; retryAfter: number | undefined }

const unreachableCode = -1

export const unreachable = {
  ok: false,
  failure: {
    code: unreachableCode,
    message: '',
    data: { errors: null },
    requestId: '',
    timestamp: '',
  },
  retryAfter: undefined,
} as const

export class Refusal extends Error {
  readonly failure: ApiFailure

  constructor(failure: ApiFailure) {
    super(failure.message)
    this.name = 'Refusal'
    this.failure = failure
  }
}

export function useRefusalNotice() {
  const t = useTranslations('site')
  return (failure: ApiFailure, retryAfter: number | undefined) => {
    if (Object.keys(fieldMessages(failure)).length > 0) {
      return
    }
    const message = failure.code === unreachableCode ? t('errorDescription') : failure.message
    const text =
      retryAfter === undefined ? message : t('retryAfter', { message, seconds: retryAfter })
    toast.danger(text, { id: text })
  }
}
