import { href } from 'react-router'
import type { FileRename } from './resource.schema'
import { useResourceCommand } from './use-resource-command'

export function useRenameFile(onDone: () => void) {
  return useResourceCommand<FileRename>(href('/resources/resource/file/rename'), { onDone })
}
