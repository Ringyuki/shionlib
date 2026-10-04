import { SearchResultsView } from '~/features/search'
import type { Route } from './+types/search'

export { searchResultsLoader as loader } from '~/features/search/search.server'

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.query ? `${loaderData.query} | Shionlib` : 'Shionlib' }]
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  return <SearchResultsView {...loaderData} />
}
