import { useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { PasswordReset } from './auth.schema'
import type { passwordResetAction } from './auth.server'

export function usePasswordReset() {
  const command = useCommand(useFetcher<typeof passwordResetAction>())
  return {
    ...command,
    run: (reset: PasswordReset) => command.run(reset),
    done: command.settled?.ok === true,
  }
}
