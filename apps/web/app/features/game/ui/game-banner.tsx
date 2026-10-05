import { Image } from '@hina-ui/react'
import type { GameImage } from '../game'

export function GameBanner({ image, className }: { image: GameImage; className?: string }) {
  return <Image src={image.url} alt="" eager lazy={false} className={className} />
}
