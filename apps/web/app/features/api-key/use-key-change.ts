import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { KeyChange } from './api-key.schema'
import type { apiKeyAction } from './api-key.server'

export function useKeyChange() {
  const command = useCommand(
    useFetcher<typeof apiKeyAction>(),
    href('/resources/settings/api-keys'),
  )
  return {
    ...command,
    run: (change: KeyChange) => command.run(change),
    confirm: (change: KeyChange) => command.confirm(change),
  }
}
