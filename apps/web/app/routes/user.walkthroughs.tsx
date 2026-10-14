import { UserWalkthroughList } from '~/features/walkthrough'
import { profileHead } from '~/features/profile'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/user.walkthroughs'

export { userWalkthroughsLoader as loader } from '~/features/walkthrough/walkthrough.server'

export function meta(args: Route.MetaArgs) {
  const [, lang, , , user] = args.matches
  return pageMeta(args, profileHead(user.loaderData.profile, lang.loaderData, 'walkthroughs'))
}

export default function UserWalkthroughsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site, , user] = matches
  return (
    <UserWalkthroughList
      walkthroughs={loaderData}
      own={site.loaderData.viewer?.id === user.loaderData.profile.id}
    />
  )
}
