import { Dialog, IconButton, Inline, toast } from '@hina-ui/react'
import { RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CropperRef } from 'react-advanced-cropper'
import { useTranslations } from 'use-intl'
import { Button } from './button'
import { ImageCropStage, type CropProgress, type CropShape } from './image-crop-stage'
import type { Picture } from './use-picture-crop'
import { useOpenState } from './use-open-state'

export type { CropShape } from './image-crop-stage'

type ImageCropDialogProps = {
  heading: string
  picture: Picture | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  shape: CropShape
  onCrop: (file: File) => Promise<boolean>
}

const outputType = 'image/webp'

const outputQuality = 0.92

function encoded(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob === null) {
          reject(new Error('The browser could not encode the picture.'))
        } else {
          resolve(blob)
        }
      },
      outputType,
      outputQuality,
    )
  })
}

export function ImageCropDialog({
  heading,
  picture,
  open,
  onOpenChange,
  shape,
  onCrop,
}: ImageCropDialogProps) {
  const t = useTranslations('picture')
  const cropper = useRef<CropperRef>(null)
  const [stage, setStage] = useOpenState<CropProgress>(open, () => 'loading')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      const canvas = cropper.current?.getCanvas({
        width: shape.width,
        height: shape.height,
        imageSmoothingQuality: 'high',
        fillColor: 'transparent',
      })
      if (canvas == null) {
        throw new Error('The cropper returned no canvas.')
      }
      const blob = await encoded(canvas)
      const file = new File([blob], `cropped-${Date.now()}.webp`, { type: blob.type })
      if (await onCrop(file)) {
        onOpenChange(false)
      }
    } catch (error) {
      toast.danger(t('failed'), { description: String(error) })
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      title={heading}
      size="xl"
      open={open}
      onOpenChange={onOpenChange}
      locked={saving}
      renderContent={() => (
        <ImageCropStage
          picture={picture}
          shape={shape}
          cropper={cropper}
          progress={stage}
          failure={t('unreadable')}
          onProgress={setStage}
        />
      )}
      renderFooter={({ close }) => (
        <Inline justify="between" align="center" gap="sm" wrap={false} className="w-full">
          <IconButton
            label={t('reset')}
            variant="outline"
            tone="neutral"
            disabled={stage !== 'ready' || saving}
            onClick={() => cropper.current?.reset()}
          >
            <RotateCcw />
          </IconButton>
          <Inline gap="sm" wrap={false}>
            <Button variant="ghost" tone="neutral" disabled={saving} onClick={close}>
              {t('cancel')}
            </Button>
            <Button loading={saving} disabled={stage !== 'ready'} onClick={() => void save()}>
              {t('apply')}
            </Button>
          </Inline>
        </Inline>
      )}
    />
  )
}
