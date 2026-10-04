import { href, useFetcher } from 'react-router'
import type { signOutAction } from './auth.server'

export function useSignOut() {
  const fetcher = useFetcher<typeof signOutAction>()
  const signOut = () =>
    fetcher.submit(
      {},
      { method: 'post', action: href('/resources/auth/sign-out'), encType: 'application/json' },
    )
  return { signOut, pending: fetcher.state !== 'idle' }
}
