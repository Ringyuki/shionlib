import { AiModelPage } from '~/features/admin-ai-model'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.model'
import { pageMeta } from '~/shared/seo/seo'

export { aiModelLoader as loader } from '~/features/admin-ai-model/admin-ai-model.server'

export function meta(args: Route.MetaArgs) {
  return pageMeta(
    args,
    args.loaderData === undefined
      ? undefined
      : { title: args.loaderData.model.name, indexable: false },
  )
}

export default function AdminAiModel({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiModelPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
