import { Center, Result, Spinner, Stack } from '@hina-ui/react'
import { useRef, type RefObject } from 'react'
import {
  CircleStencil,
  Cropper,
  ImageRestriction,
  RectangleStencil,
  type CropperRef,
} from 'react-advanced-cropper'
import 'react-advanced-cropper/dist/style.css'
import type { Picture } from './use-picture-crop'
import { useSettledBox } from './use-settled-box'

export type CropShape = { aspect: number; width: number; height: number; round: boolean }

export type CropProgress = 'loading' | 'ready' | 'failed'

type ImageCropStageProps = {
  picture: Picture | undefined
  shape: CropShape
  cropper: RefObject<CropperRef | null>
  progress: CropProgress
  failure: string
  onProgress: (progress: CropProgress) => void
}

export function ImageCropStage({
  picture,
  shape,
  cropper,
  progress,
  failure,
  onProgress,
}: ImageCropStageProps) {
  const frame = useRef<HTMLDivElement>(null)
  const settled = useSettledBox(frame)
  return (
    <Stack
      ref={frame}
      gap="none"
      className="relative h-[min(62vh,30rem)] overflow-hidden rounded-lg bg-neutral-950 p-3 max-sm:aspect-square max-sm:h-auto"
    >
      {settled && picture !== undefined && progress !== 'failed' && (
        <Cropper
          ref={cropper}
          key={picture.url}
          src={picture.url}
          className="size-full"
          stencilComponent={shape.round ? CircleStencil : RectangleStencil}
          stencilProps={{ aspectRatio: shape.aspect }}
          imageRestriction={ImageRestriction.stencil}
          backgroundWrapperProps={{ scaleImage: false, moveImage: false }}
          transitions
          onReady={() => onProgress('ready')}
          onError={() => onProgress('failed')}
        />
      )}
      {progress === 'loading' && (
        <Center className="absolute inset-0 text-white">
          <Spinner />
        </Center>
      )}
      {progress === 'failed' && <Result status="error" title={failure} className="m-auto" />}
    </Stack>
  )
}
