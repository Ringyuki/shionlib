import { AiModelPage } from '~/features/admin-ai-model'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.model'

export { aiModelLoader as loader } from '~/features/admin-ai-model/admin-ai-model.server'

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData === undefined ? [] : [{ title: `${loaderData.model.name} | Shionlib` }]
}

export default function AdminAiModel({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiModelPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
