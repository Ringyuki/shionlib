import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { BioChange } from './settings.schema'
import type { bioAction } from './settings.server'

export function useBio() {
  const command = useCommand(useFetcher<typeof bioAction>(), href('/resources/settings/bio'))
  return { ...command, run: (change: BioChange) => command.run(change) }
}
