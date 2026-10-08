import { ConnectionsSection } from '~/features/account'
import type { Route } from './+types/settings.connections'

export { connectionsLoader as loader } from '~/features/account/account.server'

export default function SettingsConnectionsRoute({ loaderData }: Route.ComponentProps) {
  return loaderData === null ? null : <ConnectionsSection connections={loaderData} />
}
