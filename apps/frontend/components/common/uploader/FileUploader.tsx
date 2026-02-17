'use client'

import * as React from 'react'
import { Card, CardContent, CardFooter } from '@/components/shionui/Card'
import {
  FileUpload as ShionFileUpload,
  Dropzone as FileUploadDropzone,
  List as FileUploadList,
  Trigger as FileUploadTrigger,
} from '@/components/shionui/FileUpload'
import { UploadController } from './UploadController'
import { UploadProgress } from './UploadProgress'
import { ShionlibLargeFileUploader } from '@/libs/uploader/uploader'
import { UploaderEvents, Phase } from '@/libs/uploader/types'
import { cn } from '@/utils/cn'
import { FileList } from './FileList'
import { UploadStatus } from './UploadStatus'
import { useTranslations } from 'next-intl'
import { AllowedLargeArchiveFileExtensions } from '@/enums/upload/allowed-large-file.enum'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { Upload as UploadIcon } from 'lucide-react'
import { OnGoingSession } from '@/components/game/upload/OnGoingSession'

interface FileUploaderProps {
  className?: string
  title?: string
  description?: string
  concurrency?: number
  desiredChunkSize?: number
  smallFileThreshold?: number
  onFileSelected?: (file: File) => void
  onPhaseChange?: (phase: Phase) => void
  onUploadComplete?: (sessionId: number) => void
}

export function FileUploader({
  className,
  concurrency,
  desiredChunkSize,
  smallFileThreshold,
  onFileSelected,
  onPhaseChange,
  onUploadComplete,
}: FileUploaderProps) {
  const t = useTranslations('Components.Common.Uploader.FileUploader')
  const [file, setFile] = React.useState<File | null>(null)
  const [phase, setPhase] = React.useState<Phase>('idle')
  React.useEffect(() => {
    onPhaseChange?.(phase)
  }, [phase, onPhaseChange])
  const [bytesHashed, setBytesHashed] = React.useState(0)
  const [bytesUploaded, setBytesUploaded] = React.useState(0)
  const [totalBytes, setTotalBytes] = React.useState(0)
  const [speedBps, setSpeedBps] = React.useState(0)
  const [etaSec, setEtaSec] = React.useState<number | null>(null)
  const uploaderRef = React.useRef<ShionlibLargeFileUploader | null>(null)
  const [pendingSessionId, setPendingSessionId] = React.useState<number | null>(null)

  const onUploadCompleteRef = React.useRef<typeof onUploadComplete>(onUploadComplete)
  React.useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete
  }, [onUploadComplete])

  const resetProgress = (f: File | null) => {
    setBytesUploaded(0)
    setBytesHashed(0)
    setTotalBytes(f?.size ?? 0)
    setSpeedBps(0)
    setEtaSec(null)
  }

  const attachListeners = React.useCallback((uploader: ShionlibLargeFileUploader) => {
    const unsubs: Array<() => void> = []
    const unsub = uploader.on((e: UploaderEvents) => {
      if (e.type === 'status') {
        console.log('set phase', e.phase)
        setPhase(e.phase)
      }
      if (e.type === 'hash-progress') {
        setBytesHashed(e.bytesHashed)
        setTotalBytes(e.totalBytes)
      }
      if (e.type === 'progress') {
        setBytesUploaded(e.bytesUploaded)
        setTotalBytes(e.totalBytes)
        setSpeedBps(e.speedBps)
        setEtaSec(e.etaSec)
      }
      if (e.type === 'done') handleComplete()
      if (e.type === 'file-mismatch') {
        // toast.error(t('fileMismatch'))
        sileo.error({ title: t('fileMismatch') })
        setPhase('idle')
        resetProgress(null)
        setFile(null)
        setPendingSessionId(null)
      }
    })
    unsubs.push(unsub)
    return () => unsubs.forEach(fn => fn())
  }, [])

  const createUploader = React.useCallback(() => {
    if (!file) return null
    const uploader = new ShionlibLargeFileUploader(file, {
      concurrency,
      desiredChunkSize,
      smallFileThreshold,
    })
    attachListeners(uploader)
    uploaderRef.current = uploader
    return uploader
  }, [file, concurrency, desiredChunkSize, smallFileThreshold, attachListeners])

  const handleFilesAccepted = async (files: File[]) => {
    const f = files?.[0] ?? null
    setFile(f)
    onFileSelected?.(f)
    setPhase('idle')
    resetProgress(f)

    if (f && pendingSessionId != null) {
      const uploader = new ShionlibLargeFileUploader(f, {
        concurrency,
        desiredChunkSize,
        smallFileThreshold,
      })
      attachListeners(uploader)
      uploaderRef.current = uploader
      try {
        await uploader.resumeFromSession(pendingSessionId)
      } finally {
        setPendingSessionId(null)
      }
    }
  }
  const handleFilesValueChange = (files: File[]) => {
    const f = files?.[0] ?? null
    setFile(f)
    onFileSelected?.(f)
    if (!f) {
      setPhase('idle')
      resetProgress(null)
    }
  }
  const handleFileReject = (f: File, message: string) => {
    console.log('file reject', message)
    console.log('file mime type', f.type)
    if (message === 'File too small') {
      // toast.error(t('fileTooSmall', { size: 200 }))
      sileo.error({ title: t('fileTooSmall', { size: 200 }) })
      return
    }
    // toast.error(t('invalidFileFormat'))
    sileo.error({ title: t('invalidFileFormat') })
  }
  React.useEffect(() => {
    if (file) {
      setTotalBytes(file.size)
    }
  }, [file])

  const handleResumeFromSession = async (sessionId: number) => {
    console.log('resume from session', sessionId)
    if (!file) {
      setPendingSessionId(sessionId)
      document.getElementById('resume-file-trigger')?.click()
      return
    }
    const uploader = uploaderRef.current ?? createUploader()
    if (!uploader) return
    await uploader.resumeFromSession(sessionId)
  }
  const handleStart = async () => {
    if (!file) return
    const uploader = uploaderRef.current ?? createUploader()
    if (!uploader) return
    console.log('start', phase)
    await uploader.start()
  }
  const handlePause = () => {
    uploaderRef.current?.pause()
  }
  const handleResume = () => {
    uploaderRef.current?.resume()
  }
  const handleCancel = async () => {
    await uploaderRef.current?.cancel()
  }
  const handleComplete = async () => {
    setPhase('completed')
    const sessionId = await uploaderRef.current?.getSessionId()
    if (sessionId) {
      onUploadCompleteRef.current?.(sessionId)
    }
    uploaderRef.current = null
  }

  const shionFileUploadDisabled = phase !== 'idle' || !!file

  return (
    <Card className={cn('w-full bg-transparent border-none shadow-none rounded-md p-0', className)}>
      <OnGoingSession onResume={handleResumeFromSession} phase={phase} />
      <CardContent className="flex flex-col gap-4 p-0">
        <ShionFileUpload
          value={file ? [file] : []}
          accept={AllowedLargeArchiveFileExtensions.join(',')}
          maxFiles={1}
          disabled={shionFileUploadDisabled}
          multiple={false}
          onAccept={handleFilesAccepted}
          onValueChange={handleFilesValueChange}
          minSize={1024 * 1024 * 200}
          onFileReject={handleFileReject}
        >
          <FileUploadDropzone className="min-h-28 w-full cursor-pointer">
            <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
              <UploadIcon className="size-4" />
              <span>{t('dropzone')}</span>
              <span>{t('dropzoneSupportFileFormat')}</span>
            </div>
          </FileUploadDropzone>
          <FileUploadTrigger id="resume-file-trigger" className="hidden" />
          <FileUploadList className="mt-2">
            <FileList phase={phase} />
          </FileUploadList>
        </ShionFileUpload>
        <UploadProgress
          bytesUploaded={bytesUploaded}
          totalBytes={totalBytes}
          speedBps={speedBps}
          etaSec={etaSec}
        />
      </CardContent>
      <CardFooter className="justify-between flex-wrap flex-col sm:flex-row gap-2 p-0">
        <UploadStatus phase={phase} bytesHashed={bytesHashed} totalBytes={totalBytes} />
        <UploadController
          phase={phase}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
        />
      </CardFooter>
    </Card>
  )
}

export default FileUploader
