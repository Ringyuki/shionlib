import { useImageResolver, type LightboxItem } from '@hina-ui/react'
import { useId, useState } from 'react'
import { imageSize, type GameImage } from './game'

export function useGallery(images: readonly GameImage[], describe: (index: number) => string) {
  const resolve = useImageResolver()
  const gallery = useId()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const thumb = (position: number) => ({
    'data-gallery': gallery,
    'data-index': String(position),
  })
  const items: LightboxItem[] = images.map((image, position) => ({
    id: `${position}-${image.url}`,
    src: resolve(image.url, 'image'),
    preview: resolve(image.url, 'preview'),
    previewSize: imageSize(image),
    alt: describe(position),
    fit: 'cover',
    source: () =>
      document.querySelector<HTMLImageElement>(
        `[data-gallery="${gallery}"][data-index="${position}"] img`,
      ),
  }))
  const show = (position: number) => {
    setIndex(position)
    setOpen(true)
  }
  return {
    thumb,
    show,
    lightbox: { items, open, onOpenChange: setOpen, index, onIndexChange: setIndex },
  }
}
