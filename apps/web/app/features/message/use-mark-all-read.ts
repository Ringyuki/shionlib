import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { markAllReadAction } from './message.server'

export function useMarkAllRead() {
  const command = useCommand(
    useFetcher<typeof markAllReadAction>(),
    href('/resources/message/read-all'),
  )
  return { run: () => command.run({}), pending: command.pending }
}
