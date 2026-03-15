'use client'

import { Modal } from '@/components/shionui/Modal'
import { useTranslations } from 'next-intl'
import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'
import { ReuploadContent } from './ReuploadContent'
import { useState } from 'react'

interface ReuploadProps {
  file: GameDownloadResourceFile
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const Reupload = ({ file, open, onOpenChange, onSuccess }: ReuploadProps) => {
  const t = useTranslations('Components.Game.Download.Reupload')
  const [closable, setClosable] = useState(true)

  const handleReuploadComplete = () => {
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Modal
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      closable={closable}
      dialogClassName="lg:max-w-5xl!"
    >
      <ReuploadContent
        file={file}
        onClosableChange={setClosable}
        onReuploadComplete={handleReuploadComplete}
      />
    </Modal>
  )
}
