import { Lightbox } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { GameImage } from '../game'
import { useGallery } from '../use-gallery'
import { GalleryThumb } from './gallery-thumb'

type GameBannerProps = {
  images: readonly GameImage[]
  index: number
  className?: string
}

export function GameBanner({ images, index, className }: GameBannerProps) {
  const t = useTranslations('game.info')
  const { thumb, show, lightbox } = useGallery(images, position =>
    t('viewScreenshot', { index: position + 1 }),
  )
  const image = images[index]
  if (image === undefined) {
    return null
  }
  return (
    <>
      <GalleryThumb
        src={image.url}
        label={t('viewScreenshot', { index: index + 1 })}
        masked={false}
        data={thumb(index)}
        onOpen={() => show(index)}
        eager
        className={className}
        imageClass="object-top"
      />
      <Lightbox {...lightbox} />
    </>
  )
}
