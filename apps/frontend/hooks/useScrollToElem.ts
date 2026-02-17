import { useCallback } from 'react'

const isBrowser = typeof window !== 'undefined'

type ScrollTarget = string | HTMLElement | null | undefined

interface ScrollToElemOptions {
  topBarSelector?: string
  extraMargin?: number
  behavior?: ScrollBehavior
  updateHash?: boolean
}

export const useScrollToElem = (options: ScrollToElemOptions = {}) => {
  const {
    topBarSelector = 'div.fixed.inset-x-0',
    extraMargin = 12,
    behavior = 'smooth',
    updateHash = true,
  } = options

  return useCallback(
    (target: ScrollTarget) => {
      if (!isBrowser || !target) return

      const element = typeof target === 'string' ? document.getElementById(target) : target
      if (!element) return

      const rect = element.getBoundingClientRect()
      const absoluteY = rect.top + window.pageYOffset
      const topBar = topBarSelector
        ? (document.querySelector(topBarSelector) as HTMLElement | null)
        : null
      const occludedTop = topBar ? topBar.getBoundingClientRect().bottom : 0
      const targetY = Math.max(absoluteY - occludedTop - extraMargin, 0)

      window.scrollTo({ top: targetY, behavior })

      const headingId = typeof target === 'string' ? target : element.id
      if (updateHash && headingId && window.location.hash !== `#${headingId}`) {
        history.replaceState(null, '', `#${headingId}`)
      }
    },
    [topBarSelector, extraMargin, behavior, updateHash],
  )
}
