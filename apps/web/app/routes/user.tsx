import { Outlet } from 'react-router'
import { ProfilePage, loadProfile, profileHead } from '~/features/profile'
import { pageMeta } from '~/shared/seo/seo'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/user'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, async api => ({ profile: await loadProfile(api, id) }))
}

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, args.loaderData && profileHead(args.loaderData.profile, lang.loaderData))
}

export default function UserRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <ProfilePage profile={loaderData.profile} viewer={site.loaderData.viewer}>
      <Outlet />
    </ProfilePage>
  )
}
