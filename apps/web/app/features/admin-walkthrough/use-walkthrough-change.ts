import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { WalkthroughChange } from './admin-walkthrough.schema'
import type { walkthroughAction } from './admin-walkthrough.server'

export function useWalkthroughChange() {
  const command = useCommand(
    useFetcher<typeof walkthroughAction>(),
    href('/resources/admin/walkthroughs'),
  )
  return { ...command, run: (change: WalkthroughChange) => command.run(change) }
}
