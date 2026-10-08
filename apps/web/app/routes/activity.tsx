import { ActivityPage } from '~/features/activity'
import type { Route } from './+types/activity'

export { feedLoader as loader } from '~/features/activity/activity.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.activity.title} | Shionlib` }]
}

export default function ActivityRoute({ loaderData }: Route.ComponentProps) {
  return <ActivityPage feed={loaderData} />
}
