import { GameResourcesItem } from '@/interfaces/user/uploads.interface'
import { Badge } from '@/components/shionui/Badge'
import { GameData, LanguageNameMap } from '@/interfaces/game/game.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { getLocale } from 'next-intl/server'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { GamePlatform } from '@/components/game/description/GamePlatform'
import { Download, FileArchive, CalendarDays } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { timeFromNow } from '@/utils/time-format'
import { Spoiler } from '@/components/shionui/Spoiler'
import { Link } from '@/i18n/navigation'

interface ResourceItemProps {
  resource: GameResourcesItem
  content_limit?: ContentLimit
}

export const ResourceItem = async ({ resource, content_limit }: ResourceItemProps) => {
  const t = await getTranslations('Components.User.Home.Uploads.ResourceItem')
  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { cover } = getPreferredContent(resource.game as unknown as GameData, 'cover', lang)
  const { title } = getPreferredContent(resource.game as unknown as GameData, 'title', lang)

  const language = resource.language.map(l => LanguageNameMap[l])

  return (
    <Link
      href={`/game/${resource.game.id}`}
      className="hover:opacity-85 transition-all duration-200"
    >
      <Card className="py-0 overflow-hidden">
        <CardContent className="px-0">
          <div className="flex flex-col sm:grid sm:grid-cols-12">
            <div className="sm:col-span-4 h-40 sm:h-full w-full">
              {(() => {
                if (cover.sexual >= 1) {
                  if (
                    content_limit === ContentLimit.SHOW_WITH_SPOILER ||
                    content_limit === ContentLimit.NEVER_SHOW_NSFW_CONTENT ||
                    !content_limit
                  )
                    return (
                      <Spoiler
                        showHint={false}
                        open={false}
                        blur={32}
                        className="!rounded-none !h-full"
                      >
                        <FadeImage src={cover.url} alt={title} />
                      </Spoiler>
                    )
                  if (content_limit === ContentLimit.JUST_SHOW)
                    return <FadeImage src={cover.url} alt={title} />
                }
                return <FadeImage src={cover.url} alt={title} />
              })()}
            </div>

            <div className="sm:col-span-8 p-4 sm:py-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 md:gap-0 md:justify-between">
                  <h3 className="text-lg font-bold">{title}</h3>
                  <Badge variant="neutral">
                    <CalendarDays className="size-4" />
                    {timeFromNow(resource.created, locale)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <GamePlatform platform={resource.platform} />
                  {language.map(l => (
                    <Badge key={l} variant="neutral">
                      {l}
                    </Badge>
                  ))}
                  {resource.game.developers.map(d => (
                    <Badge key={d.developer.id} variant="secondary">
                      {d.developer.name || d.developer.aliases?.[0]}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-4 items-center text-muted-foreground font-light font-mono!">
                  <div className="flex flex-1 gap-1 items-center overflow-hidden">
                    <FileArchive className="size-4 shrink-0" />
                    <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                      {resource.file_name}
                    </span>
                    {resource.files_count > 1 && (
                      <span>
                        {t('moreThanOneFilePrefix')}
                        {resource.files_count}
                        {t('moreThanOneFileSuffix')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    <Download className="size-4" />
                    <span>{resource.downloads}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
