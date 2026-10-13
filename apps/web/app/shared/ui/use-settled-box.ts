import { useEffect, useState, type RefObject } from 'react'

const tolerance = 0.5

export function useSettledBox(box: RefObject<HTMLElement | null>): boolean {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    let frame = 0
    const check = () => {
      const element = box.current
      if (element === null) {
        return
      }
      const shown = element.getBoundingClientRect().width
      if (Math.abs(shown - element.offsetWidth) < tolerance) {
        setSettled(true)
        return
      }
      frame = requestAnimationFrame(check)
    }
    frame = requestAnimationFrame(check)
    return () => cancelAnimationFrame(frame)
  }, [box])
  return settled
}
