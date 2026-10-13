import { TranslatorsPage } from '~/features/admin-translator'
import type { Route } from './+types/admin.translators'

export { translatorsLoader as loader } from '~/features/admin-translator/admin-translator.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminTranslator.title} | Shionlib` }]
}

export default function AdminTranslators({ loaderData }: Route.ComponentProps) {
  return <TranslatorsPage {...loaderData} />
}
