import { FavoriteItem as FavoriteItemInterface } from '@/interfaces/favorite/favorite-item.interface'
import { Link } from '@/i18n/navigation'
import { Card, CardContent } from '@/components/shionui/Card'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { Spoiler } from '@/components/shionui/Spoiler'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Badge } from '@/components/shionui/Badge'
import { GamePlatform } from '@/components/game/description/GamePlatform'
import { getLocale } from 'next-intl/server'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { GameData } from '@/interfaces/game/game.interface'
import { timeFormat, TimeFormatEnum } from '@/utils/time-format'

interface FavoriteItemProps {
  favorite: FavoriteItemInterface
  content_limit?: ContentLimit
}

export const FavoriteItem = async ({ favorite, content_limit }: FavoriteItemProps) => {
  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { cover } = getPreferredContent(favorite.game as unknown as GameData, 'cover', lang)
  const { title } = getPreferredContent(favorite.game as unknown as GameData, 'title', lang)

  return (
    <Link
      href={`/game/${favorite.game.id}`}
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
                <div className="font-bold flex flex-wrap gap-2">
                  <h1 className="text-lg">{title}</h1>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                  {favorite.game.developers.map(d => (
                    <Badge key={d.developer.id} variant="secondary">
                      {d.developer.name || d.developer.aliases?.[0]}
                    </Badge>
                  ))}
                  <span className="text-muted-foreground">
                    {timeFormat(favorite.game.release_date, locale, TimeFormatEnum.YYYY_MM_DD)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <GamePlatform platform={favorite.game.platform} max={4} show_more_count />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
