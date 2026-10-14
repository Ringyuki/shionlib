import { AiPlaygroundPage } from '~/features/admin-ai-playground'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.playground'
import { pageMeta } from '~/shared/seo/seo'

export { aiPlaygroundLoader as loader } from '~/features/admin-ai-playground/admin-ai-playground.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return pageMeta(args, { title: `${tabs.playground} · ${title}`, indexable: false })
}

export default function AdminAiPlayground({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiPlaygroundPage choices={loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
