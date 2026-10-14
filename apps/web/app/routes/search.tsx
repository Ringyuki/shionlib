import { SearchResultsView } from '~/features/search'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/search'

export { searchResultsLoader as loader } from '~/features/search/search.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  const query = args.loaderData?.query
  return pageMeta(args, { title: query || lang.loaderData.messages.search.label, indexable: false })
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
