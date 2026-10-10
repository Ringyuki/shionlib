import { useImageResolver } from '@hina-ui/react'
import { usePublicConfig } from '~/shared/config/public-config'
import { faceImage } from './image-processor'

type FaceSources = { src: string; fallback: string | undefined }

export function useFaceImage(): (picture: string, size: number) => FaceSources {
  const config = usePublicConfig()
  const resolveImage = useImageResolver()
  return (picture, size) => {
    const original = resolveImage(picture, 'image')
    const face = faceImage(config, picture, size)
    return face === undefined
      ? { src: original, fallback: undefined }
      : { src: face, fallback: original }
  }
}
