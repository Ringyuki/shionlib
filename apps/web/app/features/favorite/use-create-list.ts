import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { ListCreation } from './favorite.schema'
import type { createFavoriteListAction } from './favorite.server'

export function useCreateList() {
  const command = useCommand(
    useFetcher<typeof createFavoriteListAction>(),
    href('/resources/favorites/lists'),
  )
  return { ...command, run: (creation: ListCreation) => command.run(creation) }
}
