import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { ResourceEdit } from './resource.schema'
import type { editResourceAction } from './resource.server'

export function useEditResource() {
  const command = useCommand(
    useFetcher<typeof editResourceAction>(),
    href('/resources/resource/edit'),
  )
  return {
    ...command,
    run: (edit: ResourceEdit) => command.run(edit),
    confirm: (edit: ResourceEdit) => command.confirm(edit),
  }
}
