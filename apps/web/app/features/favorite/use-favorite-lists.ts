import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { favoriteListsLoader } from './favorite.server'

export function useFavoriteLists(gameId: number) {
  const lists = useLazyLoad(useFetcher<typeof favoriteListsLoader>())
  const load = () => {
    if (!lists.loading && lists.result === undefined) {
      void lists.load(`${href('/resources/favorites')}?game_id=${gameId}`)
    }
  }
  return { lists: lists.result, loading: lists.loading, load }
}
