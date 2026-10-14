import { AiModelsPage } from '~/features/admin-ai-model'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.models'
import { pageMeta } from '~/shared/seo/seo'

export { aiModelsLoader as loader } from '~/features/admin-ai-model/admin-ai-model.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return pageMeta(args, { title: `${tabs.models} · ${title}`, indexable: false })
}

export default function AdminAiModels({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiModelsPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
