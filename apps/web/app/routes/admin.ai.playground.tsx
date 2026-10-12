import { AiPlaygroundPage } from '~/features/admin-ai-playground'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.ai.playground'

export { aiPlaygroundLoader as loader } from '~/features/admin-ai-playground/admin-ai-playground.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  const { title, tabs } = admin.loaderData.messages.adminAi
  return [{ title: `${tabs.playground} · ${title} | Shionlib` }]
}

export default function AdminAiPlayground({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <AiPlaygroundPage choices={loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
