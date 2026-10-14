import { AiRequestsPage } from '~/features/admin-ai-request'
import type { Route } from './+types/admin.ai.requests'
import { pageMeta } from '~/shared/seo/seo'

export { aiRequestsLoader as loader } from '~/features/admin-ai-request/admin-ai-request.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return pageMeta(args, { title: `${tabs.requests} · ${title}`, indexable: false })
}

export default function AdminAiRequests({ loaderData }: Route.ComponentProps) {
  return <AiRequestsPage {...loaderData} />
}
