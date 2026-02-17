import { useEffect } from 'react'

const scrollLockState = {
  count: 0,
  previousOverflow: '',
  hadOverflowInline: false,
  previousScrollbarSize: '',
  hadScrollbarSizeInline: false,
  previousDataScrollLockedValue: '',
  hadDataScrollLocked: false,
  shouldManageScrollbarSize: false,
}

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return
    const body = document.body
    if (!body) return

    let applied = false

    try {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      const existingScrollLockedValue = body.getAttribute('data-scroll-locked') ?? ''

      if (scrollLockState.count === 0) {
        scrollLockState.previousOverflow = body.style.overflow
        scrollLockState.hadOverflowInline = body.style.overflow.length > 0
        scrollLockState.previousScrollbarSize = body.style.getPropertyValue(
          '--removed-body-scroll-bar-size',
        )
        scrollLockState.hadScrollbarSizeInline = scrollLockState.previousScrollbarSize.length > 0
        scrollLockState.previousDataScrollLockedValue = existingScrollLockedValue
        scrollLockState.hadDataScrollLocked = body.hasAttribute('data-scroll-locked')
        scrollLockState.shouldManageScrollbarSize = !existingScrollLockedValue
      }

      scrollLockState.count += 1
      applied = true

      if (!scrollLockState.hadDataScrollLocked) {
        body.setAttribute('data-scroll-locked', 'true')
      }

      if (scrollLockState.shouldManageScrollbarSize) {
        body.style.setProperty('--removed-body-scroll-bar-size', `${scrollbarWidth}px`)
      }

      body.style.overflow = 'hidden'
    } catch {
      applied = false
    }

    return () => {
      if (!applied) {
        return
      }

      scrollLockState.count = Math.max(0, scrollLockState.count - 1)

      if (scrollLockState.count === 0) {
        try {
          if (scrollLockState.hadDataScrollLocked) {
            body.setAttribute('data-scroll-locked', scrollLockState.previousDataScrollLockedValue)
          } else {
            body.removeAttribute('data-scroll-locked')
          }

          if (scrollLockState.shouldManageScrollbarSize) {
            if (scrollLockState.hadScrollbarSizeInline) {
              body.style.setProperty(
                '--removed-body-scroll-bar-size',
                scrollLockState.previousScrollbarSize,
              )
            } else {
              body.style.removeProperty('--removed-body-scroll-bar-size')
            }
          }

          if (scrollLockState.hadOverflowInline) {
            body.style.overflow = scrollLockState.previousOverflow
          } else {
            body.style.overflow = ''
          }
        } catch {
        } finally {
          scrollLockState.previousOverflow = ''
          scrollLockState.previousScrollbarSize = ''
          scrollLockState.previousDataScrollLockedValue = ''
          scrollLockState.hadOverflowInline = false
          scrollLockState.hadScrollbarSizeInline = false
          scrollLockState.hadDataScrollLocked = false
          scrollLockState.shouldManageScrollbarSize = false
        }
      }
    }
  }, [locked])
}
