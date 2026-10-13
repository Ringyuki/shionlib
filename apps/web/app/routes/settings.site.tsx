import { SiteSection } from '~/features/settings'
import type { Route } from './+types/settings.site'

export default function SettingsSiteRoute({ matches }: Route.ComponentProps) {
  const [, , site] = matches
  const { viewer } = site.loaderData
  return viewer === null ? null : <SiteSection viewer={viewer} />
}
