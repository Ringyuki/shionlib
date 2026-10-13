import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { ListEdit } from './favorite.schema'
import type { editFavoriteListAction } from './favorite.server'

export function useListEdit() {
  const command = useCommand(
    useFetcher<typeof editFavoriteListAction>(),
    href('/resources/favorites/list-edit'),
  )
  return { ...command, run: (edit: ListEdit) => command.run(edit) }
}
