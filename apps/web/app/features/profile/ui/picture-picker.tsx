import { FileUpload, toast } from '@hina-ui/react'
import { ImageUp } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { pictureTypes } from '../profile'

type PicturePickerProps = {
  label: string
  disabled: boolean
  onPick: (file: File) => void
  className?: string
}

export function PicturePicker({ label, disabled, onPick, className }: PicturePickerProps) {
  const t = useTranslations('profile.edit')
  return (
    <FileUpload
      variant="button"
      list={false}
      accept={pictureTypes}
      value={null}
      icon={<ImageUp />}
      disabled={disabled}
      className={className}
      onReject={() => toast.danger(t('unsupported'))}
      onValueChange={file => {
        if (file instanceof File) {
          onPick(file)
        }
      }}
    >
      {label}
    </FileUpload>
  )
}
