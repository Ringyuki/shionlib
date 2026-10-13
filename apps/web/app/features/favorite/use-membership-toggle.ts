import { href, useFetcher } from 'react-router'
import type { Schema } from '~/shared/api/types'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { membershipChangeCommand, type MembershipChange } from './favorite.schema'
import type { favoriteMembershipAction } from './favorite.server'

export function useMembershipToggle(list: Schema<'FavoriteSummaryDTO'>, gameId: number) {
  const command = useCommand(
    useFetcher<typeof favoriteMembershipAction>(),
    href('/resources/favorites'),
  )
  const submitted = parseOptional(membershipChangeCommand, command.payload)
  const included = submitted?.included ?? list.is_favorite === true
  const toggle = (next: boolean) => {
    const change: MembershipChange = { listId: list.id, gameId, included: next }
    void command.run(change)
  }
  return { included, toggle, pending: command.pending }
}
