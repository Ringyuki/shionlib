import { ReleaseItem } from '@/interfaces/release/upload.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { Avatar } from '@/components/common/user/Avatar'
import { Link } from '@/i18n/navigation'
import { GamePlatform } from '@/components/game/description/GamePlatform'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { getLocale } from 'next-intl/server'
import { timeFromNow } from '@/utils/time-format'
import { getTranslations } from 'next-intl/server'
import { GameData, LanguageNameMap } from '@/interfaces/game/game.interface'
import { CalendarDays, Download, FileArchive } from 'lucide-react'
import { Badge } from '@/components/shionui/Badge'

interface ReleaseCardProps {
  release: ReleaseItem
}

export const ReleaseCard = async ({ release }: ReleaseCardProps) => {
  const t = await getTranslations('Components.Release.ReleaseCard')
  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { title } = getPreferredContent(release.game as unknown as GameData, 'title', lang)

  return (
    <Link href={`/game/${release.game.id}`}>
      <Card className="py-0 hover:bg-card-hover transition-colors">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2 items-center flex-wrap">
              <Avatar user={release.creator} className="size-6 text-xs" />
              <span className="text-sm font-light flex items-center gap-1">{t('uploaded_at')}</span>
              <span className="text-sm hover:text-primary-500 transition-colors">{title}</span>
            </div>
            <Badge variant="neutral">
              <CalendarDays className="size-4" />
              {timeFromNow(release.created, locale)}
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-1 items-center font-mono!">
              <FileArchive className="size-4 shrink-0" />
              <span className="text-lg">{release.files[0]}</span>
              {release.files_count > 1 && (
                <Badge variant="secondary" className="ml-2">
                  {t('more_than_one_file', { count: release.files_count })}
                </Badge>
              )}
            </div>
            {release.note && (
              <span className="text-muted-foreground font-light font-mono!">{release.note}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <GamePlatform platform={release.platform} />
              {release.language.map(l => (
                <Badge key={l} variant="neutral">
                  {LanguageNameMap[l]}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="neutral">
                <Download className="size-4" />
                {release.downloads}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
