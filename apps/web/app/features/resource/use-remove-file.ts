import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { FileRemoval } from './resource.schema'
import type { removeFileAction } from './resource.server'

export function useRemoveFile() {
  const command = useCommand(
    useFetcher<typeof removeFileAction>(),
    href('/resources/resource/file/remove'),
  )
  return {
    ...command,
    run: (removal: FileRemoval) => command.run(removal),
    confirm: (removal: FileRemoval) => command.confirm(removal),
  }
}
