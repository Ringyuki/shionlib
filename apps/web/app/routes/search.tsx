import { SearchResultsView } from '~/features/search'
import type { Route } from './+types/search'

export { searchResultsLoader as loader } from '~/features/search/search.server'

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.query ? `${loaderData.query} | Shionlib` : 'Shionlib' }]
}

export default function SearchPage({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <SearchResultsView
      {...loaderData}
      filtered={site.loaderData.viewer?.only_games_with_resources ?? true}
    />
  )
}
