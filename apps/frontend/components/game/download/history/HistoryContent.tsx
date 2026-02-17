'use client'

import { GameDownloadResourceFileHistory } from '@/interfaces/game/game-download-resource'
import { useTranslations } from 'next-intl'
import { formatBytes } from '@/utils/format'
import { timeFromNow } from '@/utils/time-format'
import { useLocale } from 'next-intl'
import { Avatar } from '@/components/common/user/Avatar'
import { FileArchive, Calendar, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/shionui/Badge'
import { CopyButton } from '@/components/shionui/animated/CopyButton'
import { Card, CardContent } from '@/components/shionui/Card'
import { Separator } from '@/components/shionui/Separator'
import { cn } from '@/utils/cn'

interface HistoryContentProps {
  histories: GameDownloadResourceFileHistory[]
  className?: string
}

export const HistoryContent = ({ histories, className }: HistoryContentProps) => {
  const t = useTranslations('Components.Game.Download.History')
  const locale = useLocale()

  if (histories.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 gap-2', className)}>
        <FileArchive className="size-8 text-muted-foreground" />
        <span className="text-muted-foreground">{t('noHistory')}</span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-4">
        {histories.map((history, index) => (
          <Card key={history.id} className="py-0">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar user={history.operator} />
                    <span className="text-sm">{history.operator.name}</span>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {t('version')} #{histories.length - index}
                  </Badge>
                  {index === 0 && (
                    <Badge variant="success" size="sm">
                      {t('current')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  {timeFromNow(history.created, locale)}
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileArchive className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{t('fileInfo')}</span>
                </div>
                <div className="pl-6 flex flex-col gap-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[80px]">{t('fileSize')}:</span>
                    <span className="font-mono">{formatBytes(history.file_size)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground min-w-[80px]">{t('hash')}:</span>
                    <span className="font-mono text-xs break-all">
                      {history.hash_algorithm.toUpperCase()} {history.file_hash}
                    </span>
                    <CopyButton content={history.file_hash} size="xs" variant="ghost" />
                  </div>
                  {history.s3_file_key && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground min-w-[80px]">{t('s3Key')}:</span>
                      <span className="font-mono text-xs break-all">{history.s3_file_key}</span>
                    </div>
                  )}
                </div>
              </div>
              {history.reason && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{t('reason')}</span>
                    </div>
                    <div className="pl-6">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {history.reason}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
