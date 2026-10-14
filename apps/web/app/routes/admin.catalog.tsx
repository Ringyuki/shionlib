import { CatalogPage } from '~/features/admin-catalog'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.catalog'
import { pageMeta } from '~/shared/seo/seo'

export { catalogLoader as loader } from '~/features/admin-catalog/admin-catalog.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminCatalog.title, indexable: false })
}

export default function AdminCatalog({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <CatalogPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
