import { href } from 'react-router'
import type { ApiFailure } from '~/shared/api/types'
import type { FileRemoval } from './resource.schema'
import { useResourceCommand } from './use-resource-command'

export function useRemoveFile(onDone: () => void, onFailure: (failure: ApiFailure) => void) {
  return useResourceCommand<FileRemoval>(href('/resources/resource/file/remove'), {
    onDone,
    onFailure,
  })
}
