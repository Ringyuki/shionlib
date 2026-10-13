import { href, useFetcher } from 'react-router'
import { useCodeCooldown } from '~/features/auth'
import { useCommand } from '~/shared/route/use-command'
import type { EmailChange } from './account.schema'
import type { currentEmailCodeAction, emailAction, newEmailCodeAction } from './account.server'

export function useEmailChange() {
  const current = useCommand(
    useFetcher<typeof currentEmailCodeAction>(),
    href('/resources/account/email-code'),
    { revalidate: false },
  )
  const fresh = useCommand(
    useFetcher<typeof newEmailCodeAction>(),
    href('/resources/account/new-email-code'),
    { revalidate: false },
  )
  const change = useCommand(useFetcher<typeof emailAction>(), href('/resources/account/email'))
  const currentResend = useCodeCooldown()
  const freshResend = useCodeCooldown()
  return {
    current: {
      cooldown: currentResend.cooldown,
      requesting: current.pending,
      request: async () => {
        const outcome = await current.run({})
        if (outcome.ok) {
          currentResend.start()
        }
        return outcome
      },
    },
    fresh: {
      cooldown: freshResend.cooldown,
      requesting: fresh.pending,
      failure: fresh.failure,
      request: async (email: string) => {
        const outcome = await fresh.run({ email })
        if (outcome.ok) {
          freshResend.start()
        }
        return outcome
      },
    },
    run: (command: EmailChange) => change.run(command),
    pending: change.pending,
    failure: change.failure,
  }
}
