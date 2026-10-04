import type { FormHandle } from '@hina-ui/react'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'use-intl'
import { fieldMessages } from '~/shared/api/error'
import type { ApiFailure } from '~/shared/api/types'
import type { Issue } from './auth'

export function useFormFeedback(failure: ApiFailure | undefined) {
  const t = useTranslations('auth.issue')
  const form = useRef<FormHandle>(null)
  const fields = failure === undefined ? {} : fieldMessages(failure)
  const hasFields = Object.keys(fields).length > 0

  useEffect(() => {
    if (failure !== undefined) {
      form.current?.setErrors(fieldMessages(failure))
    }
  }, [failure])

  const explain = (issues: Partial<Record<string, Issue>>) => {
    const messages: Record<string, string> = {}
    for (const [field, issue] of Object.entries(issues)) {
      if (issue !== undefined) {
        messages[field] = t(issue)
      }
    }
    return messages
  }

  return { form, explain, message: hasFields ? undefined : failure?.message }
}
