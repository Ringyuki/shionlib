import type { CarouselExpose, CarouselState } from '@hina-ui/react'
import { useRef, useState } from 'react'

export function useCarouselArrows() {
  const carousel = useRef<CarouselExpose>(null)
  const [reach, setReach] = useState({ canPrev: false, canNext: false })
  return {
    carousel,
    ...reach,
    follow: ({ canPrev, canNext }: CarouselState) => setReach({ canPrev, canNext }),
    prev: () => carousel.current?.prev(),
    next: () => carousel.current?.next(),
  }
}
