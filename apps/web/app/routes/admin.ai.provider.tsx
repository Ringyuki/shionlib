import { AiProviderPage } from '~/features/admin-ai-provider'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.provider'
import { pageMeta } from '~/shared/seo/seo'

export { aiProviderLoader as loader } from '~/features/admin-ai-provider/admin-ai-provider.server'

export function meta(args: Route.MetaArgs) {
  return pageMeta(
    args,
    args.loaderData === undefined ? undefined : { title: args.loaderData.name, indexable: false },
  )
}

export default function AdminAiProvider({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiProviderPage provider={loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
