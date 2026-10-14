import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { openCommand, type OpenChange } from './admin-open.schema'
import type { openAction } from './admin-open.server'

export function useOpenChange() {
  const command = useCommand(useFetcher<typeof openAction>(), href('/resources/admin/open-api'))
  return {
    ...command,
    submitted: parseOptional(openCommand, command.payload),
    run: (change: OpenChange) => command.run(change),
    confirm: (change: OpenChange) => command.confirm(change),
  }
}
