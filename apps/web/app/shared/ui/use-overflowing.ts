import { useLayoutEffect, useRef, useState } from 'react'

export function useOverflowing<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [overflowing, setOverflowing] = useState(false)
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }
    const observer = new ResizeObserver(() =>
      setOverflowing(element.scrollWidth > element.clientWidth),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, overflowing }
}
