import { GameResourcesItem } from '@/interfaces/user/uploads.interface'
import { Badge } from '@/components/shionui/Badge'
import { LanguageNameMap } from '@/interfaces/game/game.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { getLocale } from 'next-intl/server'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { GamePlatform } from '@/components/game/description/GamePlatform'
import { Download, FileArchive, CalendarDays } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { timeFromNow } from '@/utils/time-format'
import { Avatar } from '@/components/common/user/Avatar'
import { GameEmbeddedCard } from '@/components/game/GameEmbeddedCard'

interface ResourceItemProps {
  resource: GameResourcesItem
  content_limit?: ContentLimit
}

export const ResourceItem = async ({ resource, content_limit }: ResourceItemProps) => {
  const t = await getTranslations('Components.User.Home.Uploads.ResourceItem')
  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { title } = getPreferredContent(resource.game, 'title', lang)

  return (
    <Card className="py-0">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="flex items-center gap-2">
              <Avatar user={resource.creator} className="size-6 text-xs" />
              <span className="text-sm">{resource.creator.name}</span>
            </span>
            <span className="text-sm font-light flex items-center gap-1">{t('uploaded_at')}</span>
            <span className="text-sm">{title}</span>
          </div>
          <Badge intent="neutral" appearance="outline">
            <CalendarDays className="size-4" />
            {timeFromNow(resource.created, locale)}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 items-center font-mono!">
            <FileArchive className="size-4 shrink-0" />
            <span className="text-lg">{resource.file_name}</span>
            {resource.files_count > 1 && (
              <Badge intent="secondary" appearance="solid" className="ml-2">
                {t('more_than_one_file', { count: resource.files_count })}
              </Badge>
            )}
          </div>
          {resource.note && (
            <span className="text-muted-foreground font-light font-mono!">{resource.note}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <GamePlatform platform={resource.platform} />
            {resource.language.map(l => (
              <Badge key={l} intent="neutral" appearance="outline">
                {LanguageNameMap[l]}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge intent="neutral" appearance="outline">
              <Download className="size-4" />
              {resource.downloads}
            </Badge>
          </div>
        </div>
        <GameEmbeddedCard game={resource.game} content_limit={content_limit} />
      </CardContent>
    </Card>
  )
}
