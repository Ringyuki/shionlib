import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { ResourceDeletion } from './resource.schema'
import type { deleteResourceAction } from './resource.server'

export function useDeleteResource() {
  const command = useCommand(
    useFetcher<typeof deleteResourceAction>(),
    href('/resources/resource/delete'),
  )
  return {
    ...command,
    run: (deletion: ResourceDeletion) => command.run(deletion),
    confirm: (deletion: ResourceDeletion) => command.confirm(deletion),
  }
}
