import { useEffect, useEffectEvent, useSyncExternalStore } from 'react'
import { useLocation, useMatches } from 'react-router'
import { useRefusalNotice } from './refusal'
import { rememberShown, staleReloadsNoted, subscribeToStaleReloads } from './shown-data'

export function KeptData() {
  const matches = useMatches()
  const location = useLocation()
  const notify = useRefusalNotice()
  const reloads = useSyncExternalStore(
    subscribeToStaleReloads,
    staleReloadsNoted,
    staleReloadsNoted,
  )
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
  const announce = useEffectEvent(notify)
  useEffect(() => {
    if (reloads.refusal !== undefined) {
      announce(reloads.refusal)
    }
  }, [reloads])
  return null
}
