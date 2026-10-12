import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { StalledChange } from './admin-check.schema'
import type { stalledAction } from './admin-check.server'

export function useStalledChange() {
  const command = useCommand(
    useFetcher<typeof stalledAction>(),
    href('/resources/admin/checks/stalled'),
  )
  return { ...command, confirm: (change: StalledChange) => command.confirm(change) }
}
