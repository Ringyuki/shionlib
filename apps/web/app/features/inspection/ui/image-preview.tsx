import { Lightbox } from '@hina-ui/react'
import { href } from 'react-router'
import type { Listed } from '../inspection'

type ImagePreviewProps = {
  open: boolean
  onClose: () => void
  images: readonly Listed[]
  index: number
  onIndexChange: (index: number) => void
}

export function ImagePreview({ open, onClose, images, index, onIndexChange }: ImagePreviewProps) {
  return (
    <Lightbox
      items={images.map(image => ({
        id: String(image.id),
        src: `${href('/resources/inspection/image')}?entry=${image.id}`,
        alt: image.name,
      }))}
      open={open}
      onOpenChange={next => {
        if (!next) {
          onClose()
        }
      }}
      index={index}
      onIndexChange={onIndexChange}
    />
  )
}
