import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { signOutAction } from './auth.server'

export function useSignOut() {
  const command = useCommand(useFetcher<typeof signOutAction>(), href('/resources/auth/sign-out'))
  return { signOut: () => command.run({}), pending: command.pending }
}
