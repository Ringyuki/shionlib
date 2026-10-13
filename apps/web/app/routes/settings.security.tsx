import { SecuritySection } from '~/features/account'
import type { Route } from './+types/settings.security'

export { securityLoader as loader } from '~/features/account/account.server'

export default function SettingsSecurityRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  const { viewer } = site.loaderData
  return viewer === null || loaderData === null ? null : (
    <SecuritySection viewer={viewer} security={loaderData} />
  )
}
