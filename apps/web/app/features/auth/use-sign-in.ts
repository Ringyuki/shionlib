import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { SignIn } from './auth.schema'
import type { signInAction } from './auth.server'

export function useSignIn() {
  const command = useCommand(useFetcher<typeof signInAction>(), href('/resources/auth/sign-in'))
  return { ...command, run: (credentials: SignIn) => command.run(credentials) }
}
