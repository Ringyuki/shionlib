import { Button } from '@/components/shionui/Button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/shionui/DropdownMenu'
import { useTranslations } from 'next-intl'
import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { Edit } from './edit/Edit'
import { Delete } from './delete/Delete'
import { Report } from './report/Report'
import { Reupload } from './reupload/Reupload'
import { History } from './history/History'
import { useShionlibUserStore } from '@/store/userStore'
import {
  Ellipsis,
  Pencil,
  RefreshCw,
  Trash,
  TriangleAlert,
  History as HistoryIcon,
} from 'lucide-react'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { GameDownloadResourceFileHistory } from '@/interfaces/game/game-download-resource'

interface ActionsProps {
  downloadResource: GameDownloadResource
  onEditSuccess: (id: number, data: { file_name?: string } & Partial<GameDownloadResource>) => void
  onDeleteSuccess: (id: number) => void
  onReportSuccess: (id: number) => void
  onReuploadSuccess?: (id: number) => void
}

export const Actions = ({
  downloadResource,
  onEditSuccess,
  onDeleteSuccess,
  onReportSuccess,
  onReuploadSuccess,
}: ActionsProps) => {
  const t = useTranslations('Components.Game.Download.Actions')
  const { user } = useShionlibUserStore()

  const showEdit = user.id === downloadResource.creator.id || user.role !== 1
  const showDelete = user.role !== 1 || user.id === downloadResource.creator.id
  const showReport = user.id !== downloadResource.creator.id
  const showReupload =
    downloadResource.files.length === 1 &&
    downloadResource.files[0].type === 1 &&
    (user.id === downloadResource.creator.id || user.role !== 1)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reuploadOpen, setReuploadOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyData, setHistoryData] = useState<GameDownloadResourceFileHistory[]>([])

  const handleHistoryClick = async () => {
    setHistoryLoading(true)
    try {
      const res = await shionlibRequest().get<GameDownloadResourceFileHistory[]>(
        `/game/download-source/file/${downloadResource.files[0].id}/history`,
      )
      setHistoryData(res.data ?? [])
      setHistoryOpen(true)
    } catch {
    } finally {
      setHistoryLoading(false)
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button intent="secondary" size="icon" appearance="ghost" renderIcon={<Ellipsis />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            disabled={historyLoading}
            onClick={e => {
              e.preventDefault()
              handleHistoryClick()
            }}
          >
            <HistoryIcon />
            <span>{t('history')}</span>
          </DropdownMenuItem>
          {showEdit && (
            <DropdownMenuItem disabled={editLoading} onClick={() => setEditOpen(true)}>
              <Pencil />
              <span>{t('edit')}</span>
            </DropdownMenuItem>
          )}
          {showReupload && (
            <DropdownMenuItem onClick={() => setReuploadOpen(true)}>
              <RefreshCw />
              <span>{t('reupload')}</span>
            </DropdownMenuItem>
          )}
          {showDelete && (
            <DropdownMenuItem
              disabled={deleteLoading}
              onClick={() => setDeleteOpen(true)}
              variant="destructive"
            >
              <Trash />
              <span>{t('delete')}</span>
            </DropdownMenuItem>
          )}
          {showReport && (
            <DropdownMenuItem
              disabled={reportLoading}
              onClick={() => setReportOpen(true)}
              variant="destructive"
            >
              <TriangleAlert />
              <span>{t('report')}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Edit
        downloadResource={downloadResource}
        onSuccess={onEditSuccess}
        open={editOpen}
        onOpenChange={setEditOpen}
        onLoadingChange={setEditLoading}
      />
      <Delete
        id={downloadResource.id}
        onSuccess={onDeleteSuccess}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onLoadingChange={setDeleteLoading}
      />
      <Report
        id={downloadResource.id}
        onSuccess={onReportSuccess}
        open={reportOpen}
        onOpenChange={setReportOpen}
        onLoadingChange={setReportLoading}
      />
      {showReupload && (
        <Reupload
          file={downloadResource.files[0]}
          open={reuploadOpen}
          onOpenChange={setReuploadOpen}
          onSuccess={() => onReuploadSuccess?.(downloadResource.id)}
        />
      )}
      <History
        open={historyOpen}
        onOpenChange={open => {
          setHistoryOpen(open)
          if (!open) {
            setTimeout(() => {
              setHistoryData([])
            }, 300)
          }
        }}
        histories={historyData}
      />
    </>
  )
}
