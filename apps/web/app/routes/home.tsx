import { HomePage, homeHead, loadHome } from '~/features/home'
import { routeLoader } from '~/shared/route/route.server'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/home'

export function loader(args: Route.LoaderArgs) {
  return routeLoader(args, api => loadHome(api, new Date()))
}

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, homeHead(lang.loaderData))
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <HomePage {...loaderData} />
}
