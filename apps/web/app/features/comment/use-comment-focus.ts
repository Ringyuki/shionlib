import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useHydrated } from '~/shared/ui/use-hydrated'
import { aimsAt } from './comment'

const shownFor = 2600

export function useAimedHash(): string {
  const { hash } = useLocation()
  return useHydrated() ? hash : ''
}

export function useCommentFocus(commentId: number) {
  const { key } = useLocation()
  const hash = useAimedHash()
  const aimed = aimsAt(hash, commentId)
  const visit = `${key}${hash}`
  const entry = useRef<HTMLElement>(null)
  const [faded, setFaded] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!aimed) {
      return
    }
    const box = entry.current?.getBoundingClientRect()
    if (box !== undefined && (box.top < 0 || box.bottom > window.innerHeight)) {
      entry.current?.scrollIntoView({ block: 'center' })
    }
    const timer = window.setTimeout(() => setFaded(visit), shownFor)
    return () => window.clearTimeout(timer)
  }, [aimed, visit])
  return { entry, focused: aimed && faded !== visit }
}
