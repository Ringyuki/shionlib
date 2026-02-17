'use client'

import { ReuploadDialog } from './ReuploadDialog'
import { ReuploadDrawer } from './ReuploadDrawer'
import { useMedia } from 'react-use'
import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'

interface ReuploadProps {
  file: GameDownloadResourceFile
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const Reupload = ({ file, open, onOpenChange, onSuccess }: ReuploadProps) => {
  const isMobile = useMedia('(max-width: 1024px)', false)

  const handleReuploadComplete = () => {
    onOpenChange(false)
    onSuccess()
  }

  return (
    <>
      {isMobile ? (
        <ReuploadDrawer
          file={file}
          open={open}
          onOpenChange={onOpenChange}
          onReuploadComplete={handleReuploadComplete}
        />
      ) : (
        <ReuploadDialog
          file={file}
          open={open}
          onOpenChange={onOpenChange}
          onReuploadComplete={handleReuploadComplete}
        />
      )}
    </>
  )
}
