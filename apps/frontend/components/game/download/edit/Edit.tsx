import { Modal } from '@/components/shionui/Modal'
import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { gameDownloadSourceSchemaType } from '@/components/game/upload/GameDownloadSourceInfoForm'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { useTranslations } from 'next-intl'
import { sileo } from 'sileo'
import { EditContent } from './EditContent'

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
      sileo.success({ title: t('success') })
      onSuccess(downloadResource.id, data as Partial<GameDownloadResource>)
    } catch {
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      drawerClassName="min-h-[40vh] px-3 pb-4"
    >
      <EditContent
        downloadResource={downloadResource}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </Modal>
  )
}
