import { href } from 'react-router'
import type { ResourceDeletion } from './resource.schema'
import { useResourceCommand } from './use-resource-command'

export function useDeleteResource(onDone: () => void) {
  return useResourceCommand<ResourceDeletion>(href('/resources/resource/delete'), {
    onDone,
  })
}
