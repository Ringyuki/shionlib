'use client'

import * as React from 'react'
import { cn } from '@/utils/cn'
import { Progress } from '@/components/shionui/Progress'
import { useTranslations } from 'next-intl'
import { formatBytes, formatSpeed, formatEta } from '@/utils/format'

type UploadProgressProps = {
  className?: string
  bytesUploaded: number
  totalBytes: number
  speedBps?: number
  etaSec?: number | null
}

export function UploadProgress({
  className,
  bytesUploaded,
  totalBytes,
  speedBps,
  etaSec,
}: UploadProgressProps) {
  const t = useTranslations('Components.Common.Uploader.UploadProgress')
  const percent = totalBytes > 0 ? Math.min(100, (bytesUploaded / totalBytes) * 100) : 0

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}
        </span>
        <span>{percent.toFixed(1)}%</span>
      </div>
      <Progress value={percent} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('speed')}: {formatSpeed(speedBps)}
        </span>
        <span>
          {t('eta')}: {formatEta(etaSec ?? undefined)}
        </span>
      </div>
    </div>
  )
}

export default UploadProgress
