import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { sponsorCommand, type OrderChange } from './admin-sponsor.schema'
import type { sponsorAction } from './admin-sponsor.server'

export function useOrderChange() {
  const command = useCommand(useFetcher<typeof sponsorAction>(), href('/resources/admin/sponsors'))
  return {
    ...command,
    submitted: parseOptional(sponsorCommand, command.payload),
    run: (change: OrderChange) => command.run(change),
    confirm: (change: OrderChange) => command.confirm(change),
  }
}
