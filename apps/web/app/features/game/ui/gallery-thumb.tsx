import { Card, cn, Image, Ripple, Spoiler } from '@hina-ui/react'
import { useTranslations } from 'use-intl'

type GalleryThumbProps = {
  src: string
  label: string
  ratio?: number
  masked: boolean
  data: Record<`data-${string}`, string>
  onOpen: () => void
  eager?: boolean
  className?: string
  imageClass?: string
}

export function GalleryThumb({
  src,
  label,
  ratio,
  masked,
  data,
  onOpen,
  eager = false,
  className,
  imageClass,
}: GalleryThumbProps) {
  const t = useTranslations('game.cover')
  const thumb = (
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
  return masked ? (
    <Spoiler aria-label={t('explicit')} className={cn('block w-full overflow-hidden', className)}>
      {thumb}
    </Spoiler>
  ) : (
    thumb
  )
}
