import { useState, useEffect } from 'react'
import { shionlibRequest } from '@/utils/request'
import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { GameDownloadMetaContext } from './GameDownloadContext'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/shionui/Modal'
import { GameDownloadContent } from './GameDownloadContent'

interface GameDownloadProps {
  game_id: number
  game_title?: string
  bangumi_id?: string
  vndb_id?: string
  open: boolean
  onLoadingChange: (loading: boolean) => void
  onOpenChange: (open: boolean) => void
}

export const GameDownload = ({
  game_id,
  game_title,
  bangumi_id,
  vndb_id,
  open,
  onLoadingChange,
  onOpenChange,
}: GameDownloadProps) => {
  const t = useTranslations('Components.Game.Download.GameDownload')

  const [downloadResources, setDownloadResources] = useState<GameDownloadResource[]>([])
  const [isReady, setIsReady] = useState(false)
  const [turnstileOpen, setTurnstileOpen] = useState(false)

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
    <GameDownloadMetaContext.Provider value={{ game_title, bangumi_id, vndb_id }}>
      <Modal
        title={t('title')}
        open={open && isReady}
        onOpenChange={onOpenChange}
        closable={!turnstileOpen}
        fitContent
        drawerClassName="min-h-[50vh]"
        preventAutoFocus
      >
        <GameDownloadContent
          downloadResources={downloadResources}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onTurnstileOpenChange={setTurnstileOpen}
        />
      </Modal>
    </GameDownloadMetaContext.Provider>
  )
}
