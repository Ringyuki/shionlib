import { Button, cn, Image, Spoiler } from '@hina-ui/react'
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
    <Button
      variant="ghost"
      tone="neutral"
      ripple={false}
      aria-label={label}
      onClick={onOpen}
      className={cn(
        'block h-auto w-full cursor-zoom-in overflow-hidden rounded-lg border-0 p-0 [&>.hn-transition]:size-full',
        className,
      )}
    >
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
    </Button>
  )
  return masked ? (
    <Spoiler aria-label={t('explicit')} className={cn('block w-full overflow-hidden', className)}>
      {thumb}
    </Spoiler>
  ) : (
    thumb
  )
}
