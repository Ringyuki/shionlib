import type { ReactNode } from 'react'
import { AdViewsContext, useViewTracker } from '../use-ad-views'

export function AdViews({ children }: { children: ReactNode }) {
  const tracker = useViewTracker()
  return <AdViewsContext value={tracker}>{children}</AdViewsContext>
}
