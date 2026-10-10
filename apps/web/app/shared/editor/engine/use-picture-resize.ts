import { useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { Picture } from '~/shared/richtext/rich-text'
import { resizedPercent, widestPercent } from '../picture-size'

export function usePictureResize(
  column: RefObject<HTMLElement | null>,
  picture: Picture | undefined,
  commit: (percent: number) => void,
) {
  const [dragged, setDragged] = useState<number | undefined>(undefined)
  const start = (side: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (picture === undefined) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const width = column.current?.clientWidth ?? 0
    const widest = widestPercent(picture.width, width)
    const from = Math.min(picture.widthPercent, widest)
    const origin = event.clientX
    let latest = from
    const move = (moved: PointerEvent) => {
      latest = resizedPercent(from, (moved.clientX - origin) * side, width, widest)
      setDragged(latest)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      setDragged(undefined)
      if (latest !== picture.widthPercent) {
        commit(latest)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }
  return { dragged, start }
}
