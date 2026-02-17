import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { Badge } from '@/components/shionui/Badge'
import { Avatar } from '@/components/common/user/Avatar'
import { GamePlatform } from '@/components/game/description/GamePlatform'
import { LanguageNameMap } from '@/interfaces/game/game.interface'
import { GameDownloadFileItem } from './GameDownloadFileItem'
import { timeFromNow } from '@/utils/time-format'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { Actions } from './Actions'
import { DownloadIcon } from 'lucide-react'
import { BBCodeContent } from '@/components/common/content/BBCode'

interface GameDownloadResourceItemProps {
  resource: GameDownloadResource
  onUpdate: (id: number, data: Partial<GameDownloadResource>) => void
  onDelete: (id: number) => void
  onReupload?: (id: number) => void
  onTurnstileOpenChange: (open: boolean) => void
}

export const GameDownloadResourceItem = ({
  resource,
  onUpdate,
  onDelete,
  onReupload,
  onTurnstileOpenChange,
}: GameDownloadResourceItemProps) => {
  const locale = useLocale()
  const t = useTranslations('Components.Game.Download.GameDownloadResourceItem')
  return (
    <div
      key={resource.id}
      className="flex flex-col gap-2 rounded-lg border border-accent p-4 break-words break-all"
    >
      <div className="flex flex-col gap-2 w-full">
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <GamePlatform platform={resource.platform} />
            {resource.language?.map(l => {
              return (
                <Badge key={l} variant="neutral">
                  {LanguageNameMap[l]}
                </Badge>
              )
            })}
            <Badge size="sm" variant="secondary">
              <DownloadIcon className="size-3" />
              {resource.downloads}
            </Badge>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <Avatar user={resource.creator} className="size-6 text-xs" />
            <span className="text-muted-foreground text-xs font-light flex items-center gap-1">
              <span>{t('created')}</span>
              {timeFromNow(resource.updated, locale)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-lg w-full">
        {resource.files.map(file => (
          <GameDownloadFileItem
            key={file.id}
            file={file}
            onTurnstileOpenChange={onTurnstileOpenChange}
          />
        ))}
        {resource.note && (
          <BBCodeContent content={resource.note} className="text-xs font-light font-mono! pl-2" />
        )}
      </div>
      <div className="flex gap-2 items-center justify-end">
        <Actions
          downloadResource={resource}
          onEditSuccess={onUpdate}
          onDeleteSuccess={onDelete}
          onReportSuccess={() => {}}
          onReuploadSuccess={onReupload}
        />
      </div>
    </div>
  )
}
