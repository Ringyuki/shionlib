import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { userCommand, type UserChange } from './admin-user.schema'
import type { userAction } from './admin-user.server'

export function useUserChange() {
  const command = useCommand(useFetcher<typeof userAction>(), href('/resources/admin/users'))
  return {
    ...command,
    submitted: parseOptional(userCommand, command.payload),
    run: (change: UserChange) => command.run(change),
    confirm: (change: UserChange) => command.confirm(change),
  }
}
