import { Center, cn, Image } from '@hina-ui/react'
import { BrandLogo } from '~/shared/ui/brand'
import { useImageUrl } from '~/shared/ui/image-base'
import type { Artwork } from '../auth'

export function AuthArtwork({
  artwork,
  className,
}: {
  artwork: Artwork | null
  className?: string
}) {
  const image = useImageUrl()
  return (
    <Center aria-hidden className={cn('bg-subtle relative overflow-hidden', className)}>
      {artwork === null ? (
        <BrandLogo className="size-16 opacity-40" />
      ) : (
        <Image
          src={image(artwork.url)}
          alt=""
          fit="cover"
          lazy={false}
          className="absolute inset-0 size-full"
        />
      )}
    </Center>
  )
}
