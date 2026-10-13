import { Flex, Image } from '@hina-ui/react'
import { createContext, use } from 'react'
import { createPortal } from 'react-dom'

export const BackdropSlot = createContext<HTMLElement | null>(null)

export const frosted = 'frosted'

export function PageBackdrop({ src }: { src: string }) {
  const slot = use(BackdropSlot)
  if (slot === null) {
    return null
  }
  return createPortal(
    <>
      <Image src={src} alt="" fit="cover" skeleton={false} className="size-full" />
      <Flex className="backdrop-scrim absolute inset-0" />
    </>,
    slot,
  )
}
