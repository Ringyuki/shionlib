import type { FormHandle } from '@hina-ui/react'
import { useEffect, useRef } from 'react'
import { fieldMessages } from '~/shared/api/error'
import type { ApiFailure } from '~/shared/api/types'
import { useOpenState } from '~/shared/ui/use-open-state'

export function useSubmissionFeedback(failure: ApiFailure | undefined) {
  const form = useRef<FormHandle>(null)
  const fields = failure === undefined ? {} : fieldMessages(failure)

  useEffect(() => {
    if (failure !== undefined) {
      form.current?.setErrors(fieldMessages(failure))
    }
  }, [failure])

  return { form, message: Object.keys(fields).length > 0 ? undefined : failure?.message }
}

export function useDialogFeedback(open: boolean, failure: ApiFailure | undefined) {
  const [earlier] = useOpenState(open, () => failure)
  return useSubmissionFeedback(failure === earlier ? undefined : failure)
}
