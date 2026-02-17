import { UploadQuota } from '@/components/game/upload/UploadQuota'
import { FileUploader } from '@/components/common/uploader/FileUploader'
import { GameDownloadSourceInfoForm } from './GameDownloadSourceInfoForm'
import { Phase } from '@/libs/uploader/types'
import { z } from 'zod'
import { gameDownloadSourceSchemaType } from '@/components/game/upload/GameDownloadSourceInfoForm'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
// import toast from 'react-hot-toast'
import { sileo } from 'sileo'
import { cn } from '@/utils/cn'
import { UploadTuning } from '@/components/common/uploader/UploadTuning'
import { useUploadTuningStore } from '@/store/uploadTuningStore'

interface GameUploadContentProps {
  game_id: number
  onClosableChange: (closable: boolean) => void
  onUploadComplete: () => void
  className?: string
}

export const GameUploadContent = ({
  game_id,
  onClosableChange,
  onUploadComplete,
  className,
}: GameUploadContentProps) => {
  const t = useTranslations('Components.Game.Upload.GameUploadDialog')
  const [phase, setPhase] = useState<Phase>('idle')
  const [closable, setClosable] = useState(false)
  const { getUploadTuning, setUploadTuning } = useUploadTuningStore()
  const uploadTuning = getUploadTuning()
  const [concurrency, setConcurrency] = useState(uploadTuning.concurrency)
  const [desiredChunkSize, setDesiredChunkSize] = useState(uploadTuning.chunkSize)
  useEffect(() => {
    setUploadTuning({ concurrency, chunkSize: desiredChunkSize })
  }, [concurrency, desiredChunkSize, setUploadTuning])
  const [autoSubmitTrigger, setAutoSubmitTrigger] = useState(0)
  const [settingsLocked, setSettingsLocked] = useState(false)
  useEffect(() => {
    setClosable(phase === 'idle' || phase === 'error' || phase === 'aborted')
    onClosableChange(closable)
  }, [phase, onClosableChange, closable])

  useEffect(() => {
    if (phase === 'completed') {
      setAutoSubmitTrigger(prev => prev + 1)
    }
    if (!settingsLocked && phase !== 'idle') {
      setSettingsLocked(true)
    }
  }, [phase, settingsLocked])

  const [uploadSessionId, setUploadSessionId] = useState<number | null>(null)
  const [fileSize, setFileSize] = useState<number>(0)
  const [fileName, setFileName] = useState<string>('')
  const handleFileSelected = (file: File) => {
    if (!file) {
      setFileSize(0)
      setFileName('')
      return
    }
    setFileSize(file.size)
    setFileName(file.name)
  }

  const [loading, setLoading] = useState(false)
  const handleSubmit = async (data: z.infer<typeof gameDownloadSourceSchemaType>) => {
    if (phase !== 'completed') {
      // toast.error(t('waitForUploadCompleted'))
      sileo.error({ title: t('waitForUploadCompleted') })
      return
    }
    try {
      setLoading(true)
      await shionlibRequest().post(`/game/${game_id}/download-source`, {
        data: {
          ...data,
          upload_session_id: uploadSessionId,
        },
      })
      onUploadComplete()
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn(className, 'flex flex-col gap-4')}>
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
        onPhaseChange={setPhase}
        onUploadComplete={setUploadSessionId}
        onFileSelected={handleFileSelected}
        desiredChunkSize={desiredChunkSize}
      />
      <GameDownloadSourceInfoForm
        onSubmit={handleSubmit}
        loading={loading}
        autoSubmitTrigger={autoSubmitTrigger}
        initialValues={{
          file_name: fileName,
        }}
      />
    </div>
  )
}
