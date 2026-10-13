import { AiRequestsPage } from '~/features/admin-ai-request'
import type { Route } from './+types/admin.ai.requests'

export { aiRequestsLoader as loader } from '~/features/admin-ai-request/admin-ai-request.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return [{ title: `${tabs.requests} · ${title} | Shionlib` }]
}

export default function AdminAiRequests({ loaderData }: Route.ComponentProps) {
  return <AiRequestsPage {...loaderData} />
}
