'use client'

import { FileUploader } from '@/components/common/uploader/FileUploader'
import { Phase } from '@/libs/uploader/types'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
// import toast from 'react-hot-toast'
import { sileo } from 'sileo'
import { cn } from '@/utils/cn'
import { UploadTuning } from '@/components/common/uploader/UploadTuning'
import { useUploadTuningStore } from '@/store/uploadTuningStore'
import { UploadQuota } from '@/components/game/upload/UploadQuota'
import { Alert, AlertDescription, AlertTitle } from '@/components/shionui/Alert'
import { AlertCircle, FileArchive } from 'lucide-react'
import { formatBytes } from '@/utils/format'
import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'
import { Label } from '@/components/shionui/Label'
import { Textarea } from '@/components/shionui/Textarea'

interface ReuploadContentProps {
  file: GameDownloadResourceFile
  onClosableChange: (closable: boolean) => void
  onReuploadComplete: () => void
  className?: string
}

export const ReuploadContent = ({
  file,
  onClosableChange,
  onReuploadComplete,
  className,
}: ReuploadContentProps) => {
  const t = useTranslations('Components.Game.Download.Reupload')
  const [phase, setPhase] = useState<Phase>('idle')
  const [, setClosable] = useState(true)

  const { getUploadTuning, setUploadTuning } = useUploadTuningStore()
  const uploadTuning = getUploadTuning()
  const [concurrency, setConcurrency] = useState(uploadTuning.concurrency)
  const [desiredChunkSize, setDesiredChunkSize] = useState(uploadTuning.chunkSize)
  const [settingsLocked, setSettingsLocked] = useState(false)

  useEffect(() => {
    setUploadTuning({ concurrency, chunkSize: desiredChunkSize })
  }, [concurrency, desiredChunkSize, setUploadTuning])

  const [fileSize, setFileSize] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    const canClose = phase === 'idle' || phase === 'error' || phase === 'aborted'
    setClosable(canClose && !submitting)
    onClosableChange(canClose && !submitting)
  }, [phase, submitting, onClosableChange])

  useEffect(() => {
    if (!settingsLocked && phase !== 'idle') {
      setSettingsLocked(true)
    }
  }, [phase, settingsLocked])

  const handleFileSelected = (f: File) => {
    setFileSize(f?.size ?? 0)
  }

  const handleUploadComplete = async (sessionId: number) => {
    // let toastId: string | undefined
    try {
      setSubmitting(true)
      // toastId = toast.loading(t('submitting'))
      await sileo.promise(
        shionlibRequest().put(`/game/download-source/file/${file.id}/reupload`, {
          data: {
            upload_session_id: sessionId,
            reason: reason || undefined,
          },
        }),
        {
          loading: {
            title: t('submitting'),
          },
          success: {
            title: t('success'),
          },
          error: {
            title: t('error'),
          },
        },
      )
      // toast.success(t('success'))
      onReuploadComplete()
    } catch {
      // toast.error(t('error'))
    } finally {
      setSubmitting(false)
      // toastId && toast.dismiss(toastId)
    }
  }

  return (
    <div className={cn(className, 'flex flex-col gap-4')}>
      <Alert intent="info" appearance="solid">
        <FileArchive />
        <AlertTitle>{t('currentFile')}</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-mono">{file.file_name}</span>
            <span className="font-mono">
              {formatBytes(file.file_size)} | {file.hash_algorithm.toUpperCase()}: {file.file_hash}
            </span>
          </div>
        </AlertDescription>
      </Alert>
      <Alert intent="warning" appearance="solid">
        <AlertCircle />
        <AlertTitle>{t('warningTitle')}</AlertTitle>
        <AlertDescription>{t('warningDescription')}</AlertDescription>
      </Alert>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reason">{t('reason')}</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={t('reasonPlaceholder')}
          maxLength={500}
          rows={2}
        />
        <span className="text-xs text-muted-foreground">{t('reasonHint')}</span>
      </div>
      <UploadQuota fileSize={fileSize} />
      <UploadTuning
        className="lg:max-w-5xl"
        concurrency={concurrency}
        desiredChunkSize={desiredChunkSize}
        disabled={settingsLocked}
        onConcurrencyChange={setConcurrency}
        onDesiredChunkSizeChange={setDesiredChunkSize}
      />
      <FileUploader
        className="lg:max-w-5xl"
        concurrency={concurrency}
        desiredChunkSize={desiredChunkSize}
        onPhaseChange={setPhase}
        onUploadComplete={handleUploadComplete}
        onFileSelected={handleFileSelected}
      />
    </div>
  )
}
