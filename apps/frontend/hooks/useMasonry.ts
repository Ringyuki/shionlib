import { useEffect, useLayoutEffect, useState, useRef } from 'react'

const useMasonry = () => {
  const masonryContainer = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<ChildNode[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (masonryContainer.current) {
      const masonryItem = Array.from(masonryContainer.current.children)
      setItems(masonryItem)
      setIsInitialized(true)
    }
  }, [])

  useEffect(() => {
    const container = masonryContainer.current
    if (!container) return

    const observer = new MutationObserver(() => {
      const masonryItem = Array.from(container.children)
      setItems(masonryItem)
    })

    observer.observe(container, { childList: true })

    return () => {
      observer.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    if (!isInitialized) return
    const handleMasonry = () => {
      if (!items || items.length < 1) return
      let gapSize = 0
      if (masonryContainer.current) {
        gapSize = parseInt(
          window.getComputedStyle(masonryContainer.current).getPropertyValue('row-gap'),
        )
      }
      items.forEach(el => {
        if (!(el instanceof HTMLElement)) return
        el.style.marginTop = '0'
        const epsilon = window.devicePixelRatio || 0.5
        let previous = el.previousSibling
        while (previous) {
          if (previous.nodeType === 1 && previous instanceof HTMLElement) {
            if (Math.abs(elementLeft(previous) - elementLeft(el)) < epsilon) {
              el.style.marginTop = -(elementTop(el) - elementBottom(previous) - gapSize) + 'px'
              break
            }
          }
          previous = previous.previousSibling
        }
      })
    }

    handleMasonry()
    window.addEventListener('resize', handleMasonry)
    return () => {
      window.removeEventListener('resize', handleMasonry)
    }
  }, [items, isInitialized])

  const elementLeft = (el: HTMLElement) => {
    return el.getBoundingClientRect().left
  }

  const elementTop = (el: HTMLElement) => {
    return el.getBoundingClientRect().top + window.scrollY
  }

  const elementBottom = (el: HTMLElement) => {
    return el.getBoundingClientRect().bottom + window.scrollY
  }

  return [masonryContainer, isInitialized] as const
}

export default useMasonry
