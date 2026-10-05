import { href } from 'react-router'
import type { ResourceEdit } from './resource.schema'
import { useResourceCommand } from './use-resource-command'

export function useEditResource(onDone: () => void) {
  return useResourceCommand<ResourceEdit>(href('/resources/resource/edit'), { onDone })
}
