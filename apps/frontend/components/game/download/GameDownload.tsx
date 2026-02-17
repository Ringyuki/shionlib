import { useState, useEffect } from 'react'
import { shionlibRequest } from '@/utils/request'
import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { GameDownloadDrawer } from './GameDownloadDrawer'
import { GameDownloadDialog } from './GameDownloadDialog'
import { useMedia } from 'react-use'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'

interface GameDownloadDrawerProps {
  game_id: number
  open: boolean
  onLoadingChange: (loading: boolean) => void
  onOpenChange: (open: boolean) => void
}

export const GameDownload = ({
  game_id,
  open,
  onLoadingChange,
  onOpenChange,
}: GameDownloadDrawerProps) => {
  const isMobile = useMedia('(max-width: 1024px)', false)
  const t = useTranslations('Components.Game.Download.GameDownload')

  const [downloadResources, setDownloadResources] = useState<GameDownloadResource[]>([])
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    if (!open) {
      setIsReady(false)
      return
    }
    let isCancelled = false
    setIsReady(false)
    onLoadingChange(true)
    const fetchDownload = async () => {
      try {
        const res = await shionlibRequest().get<GameDownloadResource[]>(
          `/game/${game_id}/download-source`,
        )
        if (res.data?.length === 0) {
          setIsReady(false)
          onLoadingChange(false)
          onOpenChange(false)
          // toast.error(t('noDownloadSource'))
          sileo.error({ title: t('noDownloadSource') })
          return
        }
        if (!isCancelled) {
          setDownloadResources(res.data ?? [])
          setIsReady(true)
        }
      } catch {
      } finally {
        if (!isCancelled) {
          onLoadingChange(false)
        }
      }
    }
    fetchDownload()
    return () => {
      isCancelled = true
      onLoadingChange(false)
    }
  }, [open, game_id, onLoadingChange, onOpenChange, t])

  const handleUpdate = (id: number, data: { file_name?: string } & Partial<GameDownloadResource>) =>
    setDownloadResources(prev =>
      prev.map(resource =>
        resource.id === id
          ? {
              ...resource,
              ...data,
              files: resource.files.map((f, i) =>
                i === 0 ? { ...f, file_name: data.file_name ?? f.file_name } : f,
              ),
            }
          : resource,
      ),
    )
  const handleDelete = (id: number) =>
    setDownloadResources(prev => prev.filter(resource => resource.id !== id))
  return (
    <div className="hidden">
      {isMobile ? (
        <GameDownloadDrawer
          downloadResources={downloadResources}
          open={open && isReady}
          onOpenChange={onOpenChange}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ) : (
        <GameDownloadDialog
          downloadResources={downloadResources}
          open={open && isReady}
          onOpenChange={onOpenChange}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
