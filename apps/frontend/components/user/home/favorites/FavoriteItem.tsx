import { FavoriteItem as FavoriteItemInterface } from '@/interfaces/favorite/favorite-item.interface'
import { Link } from '@/i18n/navigation'
import { Card, CardContent } from '@/components/shionui/Card'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { Spoiler } from '@/components/shionui/Spoiler'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Badge } from '@/components/shionui/Badge'
import { getLocale } from 'next-intl/server'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { GameData } from '@/interfaces/game/game.interface'
import { timeFormat, TimeFormatEnum } from '@/utils/time-format'
import { cn } from '@/utils/cn'

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
  const { intro } = getPreferredContent(favorite.game as unknown as GameData, 'intro', lang)
  const introText = intro.replace(/\s+/g, ' ').trim()

  const isNsfw = cover && cover.sexual >= 1
  const shouldBlur =
    isNsfw &&
    (content_limit === ContentLimit.SHOW_WITH_SPOILER ||
      content_limit === ContentLimit.NEVER_SHOW_NSFW_CONTENT ||
      !content_limit)

  return (
    <Link
      href={`/game/${favorite.game.id}`}
      className="group block"
      data-testid={`favorite-game-item-${favorite.id}`}
    >
      <Card
        className={cn(
          'relative overflow-hidden p-0',
          'border-border/60 bg-linear-to-br from-background/95 via-background/85 to-muted/40',
        )}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/30 blur-2xl" />
        <CardContent className="relative p-4">
          <div className="flex items-start gap-4">
            <div className="w-24 shrink-0 sm:w-28">
              <div className="relative aspect-3/4 overflow-hidden rounded-md border border-border/50 bg-muted">
                {cover &&
                  (shouldBlur ? (
                    <Spoiler blur={32} className="absolute inset-0" showHidden={false} open={false}>
                      <FadeImage
                        src={cover.url}
                        alt={title}
                        className="absolute inset-0"
                        imageClassName="object-cover"
                        sizes="10vw"
                      />
                    </Spoiler>
                  ) : (
                    <FadeImage
                      src={cover.url}
                      alt={title}
                      className="absolute inset-0"
                      imageClassName="object-cover"
                      sizes="10vw"
                    />
                  ))}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs leading-none text-muted-foreground/80">
                    #{favorite.game.id}
                  </p>
                  <h4 className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug sm:text-lg">
                    {title}
                  </h4>
                </div>
                <span className="shrink-0 pt-0.5 text-sm text-muted-foreground transition-colors group-hover:text-primary">
                  ↗
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {favorite.game.developers.slice(0, 2).map(d => (
                  <Badge key={d.developer.id} intent="secondary" appearance="solid">
                    {d.developer.name || d.developer.aliases?.[0]}
                  </Badge>
                ))}
                {favorite.game.release_date && (
                  <span className="text-sm text-muted-foreground">
                    {timeFormat(favorite.game.release_date, locale, TimeFormatEnum.YYYY_MM_DD)}
                  </span>
                )}
              </div>
              {introText && (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {introText}
                </p>
              )}
              {favorite.note && (
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground/70 italic">
                  {favorite.note}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
