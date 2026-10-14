import { AiProvidersPage } from '~/features/admin-ai-provider'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.providers'
import { pageMeta } from '~/shared/seo/seo'

export { aiProvidersLoader as loader } from '~/features/admin-ai-provider/admin-ai-provider.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return pageMeta(args, { title: `${tabs.providers} · ${title}`, indexable: false })
}

export default function AdminAiProviders({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiProvidersPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
