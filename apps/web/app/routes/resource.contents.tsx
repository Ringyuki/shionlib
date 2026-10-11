import { ContentsTab, loadContents, wantedViewFrom } from '~/features/inspection'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/resource.contents'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  const wanted = wantedViewFrom(args.url.searchParams)
  return routeLoader(args, api => loadContents(api, id, wanted))
}

export default function ResourceContentsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , , , resource] = matches
  return (
    <ContentsTab
      inspections={resource.loaderData.inspections}
      files={resource.loaderData.resource.files ?? []}
      contents={loaderData}
    />
  )
}
