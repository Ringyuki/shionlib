import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { ListRemoval } from './favorite.schema'
import type { removeFavoriteListAction } from './favorite.server'

export function useListRemoval() {
  const command = useCommand(
    useFetcher<typeof removeFavoriteListAction>(),
    href('/resources/favorites/list-remove'),
    { revalidate: false },
  )
  return { ...command, confirm: (removal: ListRemoval) => command.confirm(removal) }
}
