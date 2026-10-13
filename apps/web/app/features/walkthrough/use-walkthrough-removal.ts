import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { WalkthroughRemoval } from './walkthrough.schema'
import type { walkthroughRemovalAction } from './walkthrough.server'

export function useWalkthroughRemoval() {
  const command = useCommand(
    useFetcher<typeof walkthroughRemovalAction>(),
    href('/resources/walkthroughs/remove'),
    { revalidate: false },
  )
  return { ...command, confirm: (removal: WalkthroughRemoval) => command.confirm(removal) }
}
