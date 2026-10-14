import { ApiKeysSection } from '~/features/api-key'
import type { Route } from './+types/settings.api-keys'

export { apiKeysLoader as loader } from '~/features/api-key/api-key.server'

export default function SettingsApiKeysRoute({ loaderData }: Route.ComponentProps) {
  return <ApiKeysSection keys={loaderData} />
}
