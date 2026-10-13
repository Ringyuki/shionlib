import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { WalkthroughSave } from './walkthrough.schema'
import type { walkthroughSaveAction } from './walkthrough.server'

export function useWalkthroughSave() {
  const command = useCommand(
    useFetcher<typeof walkthroughSaveAction>(),
    href('/resources/walkthroughs'),
  )
  return { ...command, run: (save: WalkthroughSave) => command.run(save) }
}
