import { useFetcher } from 'react-router'
import type { PasswordReset } from './auth'
import type { passwordResetAction } from './auth.server'

export function usePasswordReset() {
  const fetcher = useFetcher<typeof passwordResetAction>()
  const submit = (reset: PasswordReset) =>
    fetcher.submit(reset, { method: 'post', encType: 'application/json' })
  return {
    submit,
    done: fetcher.state === 'idle' && fetcher.data?.ok === true,
    failure: fetcher.data?.ok === false ? fetcher.data.failure : undefined,
  }
}
