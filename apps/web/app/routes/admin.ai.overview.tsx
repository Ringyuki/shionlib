import { AiOverviewPage } from '~/features/admin-ai'
import type { Route } from './+types/admin.ai.overview'

export { aiOverviewLoader as loader } from '~/features/admin-ai/admin-ai.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminAi.title} | Shionlib` }]
}

export default function AdminAiOverview({ loaderData }: Route.ComponentProps) {
  return <AiOverviewPage {...loaderData} />
}
