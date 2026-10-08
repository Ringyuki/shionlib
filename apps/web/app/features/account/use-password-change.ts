import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { PasswordChange } from './account.schema'
import type { passwordAction } from './account.server'

export function usePasswordChange() {
  const command = useCommand(
    useFetcher<typeof passwordAction>(),
    href('/resources/account/password'),
  )
  return { ...command, run: (change: PasswordChange) => command.run(change) }
}
