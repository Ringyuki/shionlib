import { AiProviderPage } from '~/features/admin-ai-provider'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.provider'

export { aiProviderLoader as loader } from '~/features/admin-ai-provider/admin-ai-provider.server'

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData === undefined ? [] : [{ title: `${loaderData.name} | Shionlib` }]
}

export default function AdminAiProvider({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiProviderPage provider={loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
