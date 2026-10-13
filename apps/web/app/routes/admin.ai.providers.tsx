import { AiProvidersPage } from '~/features/admin-ai-provider'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.providers'

export { aiProvidersLoader as loader } from '~/features/admin-ai-provider/admin-ai-provider.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return [{ title: `${tabs.providers} · ${title} | Shionlib` }]
}

export default function AdminAiProviders({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiProvidersPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
