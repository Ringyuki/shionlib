import { useEffect, useEffectEvent, useSyncExternalStore } from 'react'
import { useLocation, useMatches } from 'react-router'
import { unreachable, useRefusalNotice } from './refusal'
import { rememberShown, staleReloadCount, subscribeToStaleReloads } from './shown-data'

const none = () => 0

export function KeptData() {
  const matches = useMatches()
  const location = useLocation()
  const notify = useRefusalNotice()
  const reloads = useSyncExternalStore(subscribeToStaleReloads, staleReloadCount, none)
  useEffect(() => {
    rememberShown({
      url: location.pathname + location.search,
      matches: matches.map(match => ({
        id: match.id,
        pathname: match.pathname,
        data: match.loaderData,
      })),
    })
  }, [matches, location])
  const announce = useEffectEvent(() => notify(unreachable.failure, undefined))
  useEffect(() => {
    if (reloads > 0) {
      announce()
    }
  }, [reloads])
  return null
}
