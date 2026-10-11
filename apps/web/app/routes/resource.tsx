import { Outlet } from 'react-router'
import { gameTitle } from '~/features/game'
import { headlineOf, loadResourcePage, ResourcePage } from '~/features/resource'
import { isLocale } from '~/shared/i18n/locale.schema'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/resource'

export { keptThroughSearch as shouldRevalidate } from '~/shared/route/revalidation'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, api => loadResourcePage(api, id))
}

export function meta({ loaderData, params }: Route.MetaArgs) {
  if (loaderData === undefined || !isLocale(params.lang)) {
    return []
  }
  const { name } = headlineOf(loaderData.resource.files ?? [])
  return [{ title: `${name} | ${gameTitle(loaderData.game, params.lang)} | Shionlib` }]
}

export default function ResourceRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <ResourcePage page={loaderData} viewer={site.loaderData.viewer}>
      <Outlet />
    </ResourcePage>
  )
}
