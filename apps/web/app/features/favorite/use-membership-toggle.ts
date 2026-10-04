import { href, useFetcher } from 'react-router'
import type { Schema } from '~/shared/api/types'
import { parseMembershipChange, type MembershipChange } from './favorite'
import type { favoriteMembershipAction } from './favorite.server'

export function useMembershipToggle(list: Schema<'FavoriteSummaryDTO'>, gameId: number) {
  const fetcher = useFetcher<typeof favoriteMembershipAction>()
  const submitted = parseMembershipChange(fetcher.json)
  const included = submitted?.included ?? list.is_favorite === true
  const toggle = (next: boolean) => {
    const change: MembershipChange = { listId: list.id, gameId, included: next }
    fetcher.submit(change, {
      method: 'post',
      action: href('/resources/favorites'),
      encType: 'application/json',
    })
  }
  const failure = fetcher.data?.ok === false ? fetcher.data.failure : undefined
  return { included, toggle, pending: fetcher.state !== 'idle', failure }
}
