import type { ReactNode } from 'react'
import { ExplicitContext } from '../use-explicit'
import { showsExplicit, type Viewer } from '../viewer'

type ContentLimitProviderProps = {
  viewer: Pick<Viewer, 'content_limit'> | null
  children: ReactNode
}

export function ContentLimitProvider({ viewer, children }: ContentLimitProviderProps) {
  return <ExplicitContext value={showsExplicit(viewer)}>{children}</ExplicitContext>
}
