import { Lightbox } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useShowsExplicit } from '~/features/viewer'
import { bannerIndex, plainPictures, type GameImage } from '../game'
import { useGallery } from '../use-gallery'
import { GalleryThumb } from './gallery-thumb'

type GameBannerProps = {
  images: readonly GameImage[]
  className?: string
}

export function GameBanner({ images, className }: GameBannerProps) {
  const t = useTranslations('game.info')
  const gallery = plainPictures(images, useShowsExplicit())
  const index = bannerIndex(gallery)
  const { thumb, show, lightbox } = useGallery(gallery, position =>
    t('viewScreenshot', { index: position + 1 }),
  )
  const image = index === undefined ? undefined : gallery[index]
  if (index === undefined || image === undefined) {
    return null
  }
  return (
    <>
      <GalleryThumb
        src={image.url}
        label={t('viewScreenshot', { index: index + 1 })}
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
