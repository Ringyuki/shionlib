import { createContext, useCallback, useContext, useEffect, useEffectEvent, useState } from 'react'
import { href, useFetcher, useLocation } from 'react-router'
import { constraintOf } from '~/shared/form/form-kit'
import { useCommand } from '~/shared/route/use-command'
import { dwellMs, flushDelayMs, visibleShare, type View } from './ad'
import type { viewsAction } from './ad.server'
import { viewportWatcher, ViewTracker } from './ad-tracker'

export const AdViewsContext = createContext<ViewTracker<Element> | undefined>(undefined)

const batch = constraintOf('AdViewsInputBody', 'views').maxItems ?? 1

export function useViewTracker(): ViewTracker<Element> {
  const { run } = useCommand(useFetcher<typeof viewsAction>(), href('/resources/slot-views'), {
    revalidate: false,
    quiet: true,
  })
  const [tracker] = useState(
    () =>
      new ViewTracker({
        dwellMs,
        delayMs: flushDelayMs,
        batch,
        watcher: viewportWatcher(visibleShare),
      }),
  )
  const send = useEffectEvent((views: View[]) => run({ views }))
  useEffect(() => tracker.connect(views => send(views)), [tracker])
  const { key } = useLocation()
  useEffect(() => {
    tracker.newPage()
  }, [tracker, key])
  return tracker
}

export function useAdView({ ad_id, slot }: View) {
  const tracker = useContext(AdViewsContext)
  return useCallback(
    (element: HTMLElement | null) =>
      element === null || tracker === undefined
        ? undefined
        : tracker.observe(element, { ad_id, slot }),
    [tracker, ad_id, slot],
  )
}
