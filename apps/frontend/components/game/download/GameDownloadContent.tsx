import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { cn } from '@/utils/cn'
import { GameDownloadResourceItem } from './GameDownloadResourceItem'
import { Alert, AlertDescription, AlertTitle } from '@/components/shionui/Alert'
import { useTranslations } from 'next-intl'
import { AlertCircle } from 'lucide-react'
import { BBCodeContent } from '@/components/common/content/BBCode'
import { Ad } from '@/components/common/site/Ad'

interface GameDownloadContentProps {
  className?: string
  downloadResources: GameDownloadResource[]
  onUpdate: (id: number, data: Partial<GameDownloadResource>) => void
  onDelete: (id: number) => void
  onReupload?: (id: number) => void
  onTurnstileOpenChange: (open: boolean) => void
}

export const GameDownloadContent = ({
  downloadResources,
  className,
  onUpdate,
  onDelete,
  onReupload,
  onTurnstileOpenChange,
}: GameDownloadContentProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadContent')
  return (
    <div
      className={cn(
        'flex flex-col gap-2 max-w-[-webkit-fill-available] md:w-184 px-3 mx-auto overflow-y-auto pb-4',
        className,
      )}
    >
      <Alert intent="warning" appearance="solid" className="max-w-full">
        <AlertCircle />
        <AlertTitle>{t('alertTitle')}</AlertTitle>
        <AlertDescription>
          <BBCodeContent
            content={t('alertDescription', { duration: 120, duration1: 240, duration2: 360 })}
          />
        </AlertDescription>
      </Alert>
      {downloadResources
        .sort((a, b) => b.downloads - a.downloads)
        .map(resource => (
          <GameDownloadResourceItem
            key={resource.id}
            resource={resource}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onReupload={onReupload}
            onTurnstileOpenChange={onTurnstileOpenChange}
          />
        ))}
      <Ad id={1} />
      <Ad id={2} />
    </div>
  )
}
