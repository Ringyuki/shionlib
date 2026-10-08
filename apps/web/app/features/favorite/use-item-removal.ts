import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { FavoriteItem } from './favorite'
import type { MembershipChange } from './favorite.schema'
import type { favoriteMembershipAction } from './favorite.server'

export function useItemRemoval(listId: number) {
  const action = href('/resources/favorites')
  const removal = useCommand(useFetcher<typeof favoriteMembershipAction>(), action)
  const restoring = useCommand(useFetcher<typeof favoriteMembershipAction>(), action)
  const change = (item: FavoriteItem, included: boolean): MembershipChange => ({
    listId,
    gameId: item.game.id,
    included,
    note: item.note ?? undefined,
  })
  return {
    pending: removal.pending || restoring.pending,
    remove: (item: FavoriteItem) => removal.run(change(item, false)),
    restore: (item: FavoriteItem) => restoring.run(change(item, true)),
  }
}
