import type { FormHandle } from '@hina-ui/react'
import { useEffect, useRef } from 'react'
import { fieldMessages } from '~/shared/api/error'
import type { ApiFailure } from '~/shared/api/types'

export function useFormErrors(failure: ApiFailure | undefined) {
  const form = useRef<FormHandle>(null)
  useEffect(() => {
    if (failure !== undefined) {
      form.current?.setErrors(fieldMessages(failure))
    }
  }, [failure])
  return form
}
