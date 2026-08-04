import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'
import { useTranslations, useLocale } from 'next-intl'
import { FileArchive, CloudCheck, Hash, CloudUpload, RefreshCw } from 'lucide-react'
import { timeFromNow } from '@/utils/time-format'
import { Badge } from '@/components/shionui/Badge'
import { formatBytes } from '@/utils/format'
import { useState } from 'react'
import { CopyButton } from '@/components/shionui/animated/CopyButton'
import { Question } from '@/components/common/content/Question'
import { BBCodeContent } from '@/components/common/content/bbcode/BBCode'
import { DownloadWays } from './ways/DownloadWays'

interface GameDownloadFileItemProps {
  file: GameDownloadResourceFile
  resourceId: number
  onTurnstileOpenChange: (open: boolean) => void
}

export const GameDownloadFileItem = ({
  file,
  resourceId,
  onTurnstileOpenChange,
}: GameDownloadFileItemProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')
  const locale = useLocale()
  const [downloadLink, setDownloadLink] = useState<string | null>(null)

  return (
    <div className="flex gap-2 justify-between items-center border-dashed border p-2 rounded-lg">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium font-mono! flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1">
            <FileArchive className="size-3 shrink-0" />
            <span>{file.file_name}</span>
          </span>
          <span className="text-muted-foreground text-xs">{formatBytes(file.file_size)}</span>
          {file.type === 1 && (
            <Badge
              size="sm"
              intent={
                file.file_status === 3 ? 'success' : file.file_status === 2 ? 'warning' : 'neutral'
              }
              appearance={
                file.file_status === 3 ? 'solid' : file.file_status === 2 ? 'solid' : 'outline'
              }
            >
              {file.file_status === 3 ? (
                <CloudCheck className="size-3" />
              ) : (
                <CloudUpload className="size-3" />
              )}
              {file.file_status === 3
                ? 'S3'
                : file.file_status === 2
                  ? t('processing')
                  : t('pending')}
            </Badge>
          )}
          {file.file_status !== 3 && (
            <Badge size="sm" intent="neutral" appearance="outline">
              {t('onlyVisibleForYourself')}
            </Badge>
          )}
          {file.is_virus_false_positive && (
            <Badge size="sm" intent="destructive" appearance="solid">
              {t('virusFalsePositiveFlag')}
              <Question
                content={t('virusFalsePositiveFlagDescription', {
                  detected_viruses: file.malware_scan_cases.map(c => c.detected_viruses).join(', '),
                })}
                iconClassName="text-white size-3"
              />
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground text-xs flex items-center gap-1 wrap-break-word break-all">
          <Hash className="size-3 shrink-0" />
          <span className="wrap-break-word break-all">
            {file.hash_algorithm === 'blake3' ? 'BLAKE3' : 'SHA-256'} {file.file_hash}
          </span>
          <CopyButton content={file.file_hash} size="xs" variant="ghost" />
        </div>
        {file.latest_history && (
          <div className="text-muted-foreground text-xs flex items-start gap-1">
            <RefreshCw className="size-3 shrink-0 mt-0.5" />
            <span className="flex flex-col gap-1">
              {t('lastUpdated', { time: timeFromNow(file.latest_history.created, locale) })}
              {file.latest_history.reason && (
                <BBCodeContent content={file.latest_history.reason} className="text-xs" />
              )}
            </span>
          </div>
        )}
      </div>
      {file.file_status === 3 && (
        <DownloadWays
          file={file}
          resourceId={resourceId}
          onTurnstileOpenChange={onTurnstileOpenChange}
          downloadLink={downloadLink}
          setDownloadLink={setDownloadLink}
        />
      )}
    </div>
  )
}
