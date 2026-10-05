import { href, useFetcher } from 'react-router'
import type { EmailOnly } from './auth.schema'
import type { passwordResetRequestAction } from './auth.server'

export function usePasswordResetRequest() {
  const fetcher = useFetcher<typeof passwordResetRequestAction>()
  const submit = (request: EmailOnly) =>
    fetcher.submit(request, {
      method: 'post',
      action: href('/resources/auth/password-reset'),
      encType: 'application/json',
    })
  const done = fetcher.state === 'idle' && fetcher.data?.ok === true
  return {
    submit,
    pending: fetcher.state !== 'idle',
    failure: fetcher.data?.ok === false ? fetcher.data.failure : undefined,
    done,
  }
}
