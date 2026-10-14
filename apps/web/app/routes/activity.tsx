import { adPage } from '~/features/ad'
import { ActivityPage } from '~/features/activity'
import type { Route } from './+types/activity'
import { pageMeta } from '~/shared/seo/seo'

export const handle = adPage

export { feedLoader as loader } from '~/features/activity/activity.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.activity.title })
}

export default function ActivityRoute({ loaderData }: Route.ComponentProps) {
  return <ActivityPage feed={loaderData} />
}
