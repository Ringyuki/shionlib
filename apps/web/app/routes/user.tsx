import { Outlet } from 'react-router'
import { ProfilePage, loadProfile } from '~/features/profile'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/user'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, async api => ({ profile: await loadProfile(api, id) }))
}

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData === undefined ? [] : [{ title: `${loaderData.profile.name} | Shionlib` }]
}

export default function UserRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <ProfilePage profile={loaderData.profile} viewer={site.loaderData.viewer}>
      <Outlet />
    </ProfilePage>
  )
}
