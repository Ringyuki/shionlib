import { Card, cn, Image, Ripple } from '@hina-ui/react'

type GalleryThumbProps = {
  src: string
  thumbhash: string | undefined
  label: string
  ratio?: number
  data: Record<`data-${string}`, string>
  onOpen: () => void
  eager?: boolean
  className?: string
  imageClass?: string
}

export function GalleryThumb({
  src,
  thumbhash,
  label,
  ratio,
  data,
  onOpen,
  eager = false,
  className,
  imageClass,
}: GalleryThumbProps) {
  return (
    <Card
      as="button"
      padded={false}
      aria-label={label}
      onClick={onOpen}
      className={cn(
        'hn-interactive hn-state-layer hn-press-lg block w-full cursor-zoom-in',
        className,
      )}
    >
      <Ripple />
      <Image
        src={src}
        thumbhash={thumbhash}
        alt=""
        ratio={ratio}
        fit="cover"
        eager={eager}
        className={ratio === undefined ? 'size-full' : 'w-full'}
        imageClass={imageClass}
        {...data}
      />
    </Card>
  )
}
