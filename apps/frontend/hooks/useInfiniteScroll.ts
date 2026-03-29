import { useCallback, useEffect, useRef, useState } from 'react'

interface UseInfiniteScrollOptions {
  enabled?: boolean
  hasMore?: boolean
  onLoadMore: () => void | Promise<void>
  root?: Element | Document | null
  rootMargin?: string
  threshold?: number | number[]
  autoLoadPages?: number
  loadedPages?: number
}

interface UseInfiniteScrollResult<T extends Element> {
  setTargetRef: (node: T | null) => void
  isPaused: boolean
  loadMore: () => void
}

export const useInfiniteScroll = <T extends Element = HTMLDivElement>({
  enabled = true,
  hasMore = true,
  onLoadMore,
  root = null,
  rootMargin = '0px 0px 240px 0px',
  threshold = 0,
  autoLoadPages,
  loadedPages = 0,
}: UseInfiniteScrollOptions): UseInfiniteScrollResult<T> => {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const targetRef = useRef<T | null>(null)
  const inFlightRef = useRef(false)
  const autoLoadCountRef = useRef(loadedPages)
  const [isPaused, setIsPaused] = useState(
    () => autoLoadPages !== undefined && loadedPages >= autoLoadPages,
  )
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

  const loadMore = useCallback(() => {
    const current = optionsRef.current
    if (!current.enabled || !current.hasMore || inFlightRef.current) return

    inFlightRef.current = true
    Promise.resolve(current.onLoadMore())
      .catch(() => undefined)
      .finally(() => {
        inFlightRef.current = false
      })
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

        if (autoLoadPages !== undefined && autoLoadCountRef.current >= autoLoadPages) {
          setIsPaused(true)
          return
        }

        inFlightRef.current = true

        Promise.resolve(current.onLoadMore())
          .catch(() => undefined)
          .finally(() => {
            inFlightRef.current = false
            autoLoadCountRef.current++

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
  }, [root, rootMargin, threshold, autoLoadPages])

  return { setTargetRef, isPaused, loadMore }
}
