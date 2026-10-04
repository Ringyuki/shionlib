import { href, useFetcher } from 'react-router'
import type { favoriteListsLoader } from './favorite.server'

export function useFavoriteLists(gameId: number) {
  const fetcher = useFetcher<typeof favoriteListsLoader>()
  const load = () => {
    if (fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(`${href('/resources/favorites')}?game_id=${gameId}`)
    }
  }
  return { lists: fetcher.data, loading: fetcher.state === 'loading', load }
}
