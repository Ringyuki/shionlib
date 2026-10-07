import { HomePage, loadHome } from '~/features/home'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/home'

export function loader(args: Route.LoaderArgs) {
  return routeLoader(args, api => loadHome(api, new Date()))
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <HomePage {...loaderData} />
}
