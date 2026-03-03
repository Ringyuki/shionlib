import { useCallback, useEffect, useRef } from 'react'

interface UseInfiniteScrollOptions {
  enabled?: boolean
  hasMore?: boolean
  onLoadMore: () => void | Promise<void>
  root?: Element | Document | null
  rootMargin?: string
  threshold?: number | number[]
}

export const useInfiniteScroll = <T extends Element = HTMLDivElement>({
  enabled = true,
  hasMore = true,
  onLoadMore,
  root = null,
  rootMargin = '0px 0px 240px 0px',
  threshold = 0,
}: UseInfiniteScrollOptions) => {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const targetRef = useRef<T | null>(null)
  const inFlightRef = useRef(false)
  const optionsRef = useRef({ enabled, hasMore, onLoadMore })

  optionsRef.current = { enabled, hasMore, onLoadMore }

  const setTargetRef = useCallback((node: T | null) => {
    if (observerRef.current && targetRef.current) {
      observerRef.current.unobserve(targetRef.current)
    }

    targetRef.current = node

    if (observerRef.current && node) {
      observerRef.current.observe(node)
    }
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        const target = targetRef.current

        if (!entry?.isIntersecting || !target) return

        const current = optionsRef.current
        if (!current.enabled || !current.hasMore || inFlightRef.current) return

        inFlightRef.current = true

        Promise.resolve(current.onLoadMore())
          .catch(() => undefined)
          .finally(() => {
            inFlightRef.current = false

            const latestTarget = targetRef.current
            if (!latestTarget || !observerRef.current) return

            // Re-observe so a sentinel still inside the viewport can request the next page.
            observerRef.current.unobserve(latestTarget)
            observerRef.current.observe(latestTarget)
          })
      },
      { root, rootMargin, threshold },
    )

    observerRef.current = observer

    if (targetRef.current) {
      observer.observe(targetRef.current)
    }

    return () => {
      observer.disconnect()
      if (observerRef.current === observer) {
        observerRef.current = null
      }
    }
  }, [root, rootMargin, threshold])

  return setTargetRef
}
