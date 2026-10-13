import { AiModelsPage } from '~/features/admin-ai-model'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.models'

export { aiModelsLoader as loader } from '~/features/admin-ai-model/admin-ai-model.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return [{ title: `${tabs.models} · ${title} | Shionlib` }]
}

export default function AdminAiModels({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiModelsPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
