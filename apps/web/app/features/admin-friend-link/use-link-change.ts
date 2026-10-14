import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { linkCommand, type LinkChange } from './admin-friend-link.schema'
import type { friendLinkAction } from './admin-friend-link.server'

export function useLinkChange() {
  const command = useCommand(
    useFetcher<typeof friendLinkAction>(),
    href('/resources/admin/friend-links'),
  )
  return {
    ...command,
    submitted: parseOptional(linkCommand, command.payload),
    run: (change: LinkChange) => command.run(change),
    confirm: (change: LinkChange) => command.confirm(change),
  }
}
