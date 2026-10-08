import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { EmailOnly } from './auth.schema'
import type { passwordResetRequestAction } from './auth.server'

export function usePasswordResetRequest() {
  const command = useCommand(
    useFetcher<typeof passwordResetRequestAction>(),
    href('/resources/auth/password-reset'),
  )
  return {
    ...command,
    run: (request: EmailOnly) => command.run(request),
    done: command.settled?.ok === true,
  }
}
