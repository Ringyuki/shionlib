import { href, useFetcher } from 'react-router'
import type { SignIn } from './auth'
import type { signInAction } from './auth.server'

export function useSignIn() {
  const fetcher = useFetcher<typeof signInAction>()
  const submit = (credentials: SignIn) =>
    fetcher.submit(credentials, {
      method: 'post',
      action: href('/resources/auth/sign-in'),
      encType: 'application/json',
    })
  const failure = fetcher.data?.ok === false ? fetcher.data.failure : undefined
  return { submit, pending: fetcher.state !== 'idle', failure }
}
