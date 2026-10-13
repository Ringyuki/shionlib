import { UserWalkthroughList } from '~/features/walkthrough'
import type { Route } from './+types/user.walkthroughs'

export { userWalkthroughsLoader as loader } from '~/features/walkthrough/walkthrough.server'

export default function UserWalkthroughsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site, , user] = matches
  return (
    <UserWalkthroughList
      walkthroughs={loaderData}
      own={site.loaderData.viewer?.id === user.loaderData.profile.id}
    />
  )
}
