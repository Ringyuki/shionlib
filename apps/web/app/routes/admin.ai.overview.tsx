import { AiOverviewPage } from '~/features/admin-ai'
import type { Route } from './+types/admin.ai.overview'
import { pageMeta } from '~/shared/seo/seo'

export { aiOverviewLoader as loader } from '~/features/admin-ai/admin-ai.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminAi.title, indexable: false })
}

export default function AdminAiOverview({ loaderData }: Route.ComponentProps) {
  return <AiOverviewPage {...loaderData} />
}
