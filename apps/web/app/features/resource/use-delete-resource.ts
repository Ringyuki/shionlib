import { href } from 'react-router'
import type { ApiFailure } from '~/shared/api/types'
import type { ResourceDeletion } from './resource.schema'
import { useResourceCommand } from './use-resource-command'

export function useDeleteResource(onDone: () => void, onFailure: (failure: ApiFailure) => void) {
  return useResourceCommand<ResourceDeletion>(href('/resources/resource/delete'), {
    onDone,
    onFailure,
  })
}
