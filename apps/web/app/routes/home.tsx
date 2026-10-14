import { adPage, adsIn, AdSlot, loadPlacements } from '~/features/ad'
import { HomePage, homeHead, loadHome } from '~/features/home'
import { routeLoader } from '~/shared/route/route.server'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/home'

export const handle = adPage

export function loader(args: Route.LoaderArgs) {
  return routeLoader(args, async api => {
    const [home, placements] = await Promise.all([
      loadHome(api, new Date()),
      loadPlacements(api, args.params.lang, ['home']),
    ])
    return { home, ads: adsIn(placements, 'home') }
  })
}

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, homeHead(lang.loaderData))
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <HomePage {...loaderData.home} banner={<AdSlot slot="home" ads={loaderData.ads} />} />
}
