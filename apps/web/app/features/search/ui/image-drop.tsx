import { FileUpload, Inline, Stack, Text, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { imageTypes, type ImageSource } from '../search-image'
import { ImageCredit } from './image-credit'

type ImageDropProps = {
  source: ImageSource | null
  onChoose: (file: File) => void
}

export function ImageDrop({ source, onChoose }: ImageDropProps) {
  const t = useTranslations('search.image')
  return (
    <Stack gap="sm" className="p-3.5">
      <FileUpload
        list={false}
        accept={imageTypes.join(',')}
        value={null}
        aria-label={t('choose')}
        className="h-44"
        onReject={() => toast.danger(t('unsupported'))}
        onValueChange={file => {
          if (file instanceof File) {
            onChoose(file)
          }
        }}
      >
        {t('drop')}
      </FileUpload>
      <Inline justify="between" align="center" gap="sm">
        <Text as="span" size="xs" tone="muted">
          {t('formats')}
        </Text>
        <ImageCredit source={source} />
      </Inline>
    </Stack>
  )
}
