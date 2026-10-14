import { TranslatorsPage } from '~/features/admin-translator'
import type { Route } from './+types/admin.translators'
import { pageMeta } from '~/shared/seo/seo'

export { translatorsLoader as loader } from '~/features/admin-translator/admin-translator.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, {
    title: admin.loaderData.messages.adminTranslator.title,
    indexable: false,
  })
}

export default function AdminTranslators({ loaderData }: Route.ComponentProps) {
  return <TranslatorsPage {...loaderData} />
}
