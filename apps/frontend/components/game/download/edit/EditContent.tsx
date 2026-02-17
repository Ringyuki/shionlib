import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { GameDownloadSourceInfoForm } from '@/components/game/upload/GameDownloadSourceInfoForm'
import { gameDownloadSourceSchemaType } from '@/components/game/upload/GameDownloadSourceInfoForm'
import { z } from 'zod'

interface EditContentProps {
  downloadResource: GameDownloadResource
  onSubmit: (data: z.infer<typeof gameDownloadSourceSchemaType>) => void
  isSubmitting: boolean
}

export const EditContent = ({ downloadResource, onSubmit, isSubmitting }: EditContentProps) => {
  return (
    <GameDownloadSourceInfoForm
      onSubmit={onSubmit}
      loading={isSubmitting}
      initialValues={{
        file_name: downloadResource.files[0].file_name,
        platform: downloadResource.platform,
        language: downloadResource.language,
        note: downloadResource.note ?? '',
      }}
    />
  )
}
