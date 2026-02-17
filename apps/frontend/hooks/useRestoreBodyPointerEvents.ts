import { useEffect } from 'react'

const pointerEventsState = {
  count: 0,
  previousValue: '',
  hadInlineValue: false,
}

function shouldOverrideBodyPointerEvents() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  try {
    return window.getComputedStyle(document.body).pointerEvents === 'none'
  } catch {
    return false
  }
}

export function useRestoreBodyPointerEvents(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (typeof document === 'undefined') return

    const body = document.body
    if (!body) return

    const needsOverride = pointerEventsState.count > 0 || shouldOverrideBodyPointerEvents()

    if (!needsOverride) {
      return
    }

    if (pointerEventsState.count === 0) {
      pointerEventsState.previousValue = body.style.pointerEvents
      pointerEventsState.hadInlineValue = body.style.pointerEvents.length > 0
      body.style.pointerEvents = 'auto'
    }

    pointerEventsState.count += 1
    let cleanedUp = false

    return () => {
      if (cleanedUp) return
      cleanedUp = true
      pointerEventsState.count = Math.max(0, pointerEventsState.count - 1)

      if (pointerEventsState.count === 0) {
        if (pointerEventsState.hadInlineValue) {
          body.style.pointerEvents = pointerEventsState.previousValue
        } else {
          body.style.removeProperty('pointer-events')
        }
      }
    }
  }, [active])
}
