'use client'

import { ImageCrop, ImageCropApply, ImageCropContent } from '@/components/shionui/Cropper'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/shionui/Dialog'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'

interface AvatarResizeProps {
  image: File
  open: boolean
  setOpen: (open: boolean) => void
  onCrop: (croppedImage: string | null) => void
}

export const AvatarResize = ({ image, open, setOpen, onCrop }: AvatarResizeProps) => {
  const t = useTranslations('Components.User.Settings.AvatarResize')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined} className="sm:w-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 justify-center">
          <ImageCrop file={image} onCrop={onCrop} aspect={1}>
            <ImageCropContent />
            <DialogFooter className="justify-end">
              <ImageCropApply asChild>
                <Button intent="primary" onClick={() => setOpen(false)}>
                  {t('crop')}
                </Button>
              </ImageCropApply>
            </DialogFooter>
          </ImageCrop>
        </div>
      </DialogContent>
    </Dialog>
  )
}
