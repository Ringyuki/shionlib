import { EditDialog } from './EditDialog'
import { EditDrawer } from './EditDrawer'
import { useMedia } from 'react-use'
import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { gameDownloadSourceSchemaType } from '@/components/game/upload/GameDownloadSourceInfoForm'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { useTranslations } from 'next-intl'
// import toast from 'react-hot-toast'
import { sileo } from 'sileo'

interface EditProps {
  downloadResource: GameDownloadResource
  onSuccess: (id: number, data: Partial<GameDownloadResource>) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadingChange: (loading: boolean) => void
}

export const Edit = ({
  downloadResource,
  onSuccess,
  open,
  onOpenChange,
  onLoadingChange,
}: EditProps) => {
  const isMobile = useMedia('(max-width: 1024px)', false)
  const t = useTranslations('Components.Game.Download.Edit')

  const [isSubmitting, setIsSubmitting] = useState(false)
  useEffect(() => {
    onOpenChange(open)
  }, [open, onOpenChange])
  useEffect(() => {
    onLoadingChange(isSubmitting)
  }, [isSubmitting, onLoadingChange])

  const handleSubmit = async (data: z.infer<typeof gameDownloadSourceSchemaType>) => {
    setIsSubmitting(true)
    try {
      await shionlibRequest().patch(`/game/download-source/${downloadResource.id}`, {
        data: data,
      })
      onOpenChange(false)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      onSuccess(downloadResource.id, data as Partial<GameDownloadResource>)
    } catch {
    } finally {
      setIsSubmitting(false)
    }
  }
  return (
    <>
      {isMobile ? (
        <EditDrawer
          downloadResource={downloadResource}
          open={open}
          onOpenChange={onOpenChange}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      ) : (
        <EditDialog
          downloadResource={downloadResource}
          open={open}
          onOpenChange={onOpenChange}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  )
}
