import { useEffect, useState } from 'react'

function insetOf(viewport: VisualViewport): number {
  if (viewport.scale > 1) {
    return 0
  }
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
}

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const viewport = window.visualViewport
    if (viewport === null) {
      return
    }
    const measure = () => setInset(insetOf(viewport))
    measure()
    viewport.addEventListener('resize', measure)
    viewport.addEventListener('scroll', measure)
    return () => {
      viewport.removeEventListener('resize', measure)
      viewport.removeEventListener('scroll', measure)
    }
  }, [])
  return inset
}
