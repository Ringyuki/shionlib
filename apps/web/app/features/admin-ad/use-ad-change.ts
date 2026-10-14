import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { adCommand, type AdChange } from './admin-ad.schema'
import type { adAction } from './admin-ad.server'

export function useAdChange() {
  const command = useCommand(useFetcher<typeof adAction>(), href('/resources/admin/ads'))
  return {
    ...command,
    submitted: parseOptional(adCommand, command.payload),
    run: (change: AdChange) => command.run(change),
    confirm: (change: AdChange) => command.confirm(change),
  }
}
