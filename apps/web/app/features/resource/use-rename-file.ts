import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { FileRename } from './resource.schema'
import type { renameFileAction } from './resource.server'

export function useRenameFile() {
  const command = useCommand(
    useFetcher<typeof renameFileAction>(),
    href('/resources/resource/file/rename'),
  )
  return {
    ...command,
    run: (rename: FileRename) => command.run(rename),
    confirm: (rename: FileRename) => command.confirm(rename),
  }
}
