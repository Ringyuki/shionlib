import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { PotatoSignIn } from './account.schema'
import type {
  identityRemovalAction,
  potatoBindingAction,
  potatoUnbindingAction,
} from './account.server'

export function useIdentityRemoval() {
  const command = useCommand(
    useFetcher<typeof identityRemovalAction>(),
    href('/resources/account/identity-remove'),
  )
  return { confirm: (id: number) => command.confirm({ id }) }
}

export function usePotatoBinding() {
  const command = useCommand(
    useFetcher<typeof potatoBindingAction>(),
    href('/resources/account/potato-bind'),
  )
  return { ...command, run: (request: PotatoSignIn) => command.run(request) }
}

export function usePotatoUnbinding() {
  const command = useCommand(
    useFetcher<typeof potatoUnbindingAction>(),
    href('/resources/account/potato-unbind'),
  )
  return { confirm: () => command.confirm({}) }
}
