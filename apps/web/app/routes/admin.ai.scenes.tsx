import { AiScenesPage } from '~/features/admin-ai'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.scenes'
import { pageMeta } from '~/shared/seo/seo'

export { aiScenesLoader as loader } from '~/features/admin-ai/admin-ai.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return pageMeta(args, { title: `${tabs.scenes} · ${title}`, indexable: false })
}

export default function AdminAiScenes({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiScenesPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
