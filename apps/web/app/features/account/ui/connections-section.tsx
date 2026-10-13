import type { Connections } from '../account'
import { useLinkResult } from '../use-link-result'
import { IdentityPanel } from './identity-panel'
import { PotatoPanel } from './potato-panel'

export function ConnectionsSection({ connections }: { connections: Connections }) {
  useLinkResult(connections.linkResult)
  return (
    <>
      <IdentityPanel identities={connections.identities} />
      <PotatoPanel binding={connections.potato} />
    </>
  )
}
