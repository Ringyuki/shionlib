import { useEffect, useEffectEvent } from 'react'
import { href, useFetcher } from 'react-router'
import type { ApiFailure, Schema } from '~/shared/api/types'
import { parseOptional } from '~/shared/form/check'
import { membershipChangeCommand, type MembershipChange } from './favorite.schema'
import type { favoriteMembershipAction } from './favorite.server'

export function useMembershipToggle(
  list: Schema<'FavoriteSummaryDTO'>,
  gameId: number,
  onFailure: (failure: ApiFailure) => void,
) {
  const fetcher = useFetcher<typeof favoriteMembershipAction>()
  const submitted = parseOptional(membershipChangeCommand, fetcher.json)
  const included = submitted?.included ?? list.is_favorite === true
  const failed = useEffectEvent(onFailure)
  const settled = fetcher.state === 'idle' ? fetcher.data : undefined
  useEffect(() => {
    if (settled?.ok === false) {
      failed(settled.failure)
    }
  }, [settled])
  const toggle = (next: boolean) => {
    const change: MembershipChange = { listId: list.id, gameId, included: next }
    fetcher.submit(change, {
      method: 'post',
      action: href('/resources/favorites'),
      encType: 'application/json',
    })
  }
  return { included, toggle, pending: fetcher.state !== 'idle' }
}
