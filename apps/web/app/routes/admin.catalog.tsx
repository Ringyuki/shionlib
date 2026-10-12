import { CatalogPage } from '~/features/admin-catalog'
import { isSuperAdmin } from '~/features/viewer'
import type { Route } from './+types/admin.catalog'

export { catalogLoader as loader } from '~/features/admin-catalog/admin-catalog.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminCatalog.title} | Shionlib` }]
}

export default function AdminCatalog({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <CatalogPage {...loaderData} editable={isSuperAdmin(site.loaderData.viewer)} />
}
