import { href } from 'react-router'
import type { FileRemoval } from './resource.schema'
import { useResourceCommand } from './use-resource-command'

export function useRemoveFile(onDone: () => void) {
  return useResourceCommand<FileRemoval>(href('/resources/resource/file/remove'), {
    onDone,
  })
}
