import { useTranslations } from 'next-intl'
import { PhaseMap } from './PhaseMap'
import { Phase } from '@/libs/uploader/types'
import { Progress } from '@/components/shionui/Progress'

interface UploadStatusProps {
  phase: Phase
  bytesHashed: number
  totalBytes: number
}

export function UploadStatus({ phase, bytesHashed, totalBytes }: UploadStatusProps) {
  const t = useTranslations('Components.Common.Uploader.FileUploader')
  const percent = totalBytes > 0 ? Math.min(100, (bytesHashed / totalBytes) * 100) : 0

  return (
    <div className="text-xs text-muted-foreground flex gap-2 items-center w-fit">
      <span className="shrink-0">
        {t('status')}: {t(PhaseMap[phase])}
      </span>
      {phase === 'hashing' && <Progress value={percent} className="w-full shrink-0" />}
    </div>
  )
}
