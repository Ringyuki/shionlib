import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { WalkthroughPublish } from './walkthrough.schema'
import type { walkthroughPublishAction } from './walkthrough.server'

export function useWalkthroughPublish() {
  const command = useCommand(
    useFetcher<typeof walkthroughPublishAction>(),
    href('/resources/walkthroughs/publish'),
  )
  return { ...command, run: (publish: WalkthroughPublish) => command.run(publish) }
}
