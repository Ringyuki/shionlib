import { AiScenesPage } from '~/features/admin-ai'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.scenes'

export { aiScenesLoader as loader } from '~/features/admin-ai/admin-ai.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return [{ title: `${tabs.scenes} · ${title} | Shionlib` }]
}

export default function AdminAiScenes({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiScenesPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
