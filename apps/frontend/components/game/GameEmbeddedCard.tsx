'use client'

import { Card, CardContent } from '@/components/shionui/Card'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { GameData } from '@/interfaces/game/game.interface'
import { Link } from '@/i18n/navigation.client'
import { cn } from '@/utils/cn'
import { useLocale } from 'next-intl'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { Spoiler } from '@/components/shionui/Spoiler'

export type EmbeddedGame = Pick<
  GameData,
  'id' | 'title_jp' | 'title_zh' | 'title_en' | 'intro_jp' | 'intro_zh' | 'intro_en' | 'covers'
>

interface GameEmbeddedCardProps {
  game: EmbeddedGame
  content_limit?: ContentLimit
  className?: string
}

export const GameEmbeddedCard = ({ game, className, content_limit }: GameEmbeddedCardProps) => {
  const locale = useLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'

  const { title } = getPreferredContent(game, 'title', lang)
  const { intro } = getPreferredContent(game, 'intro', lang)
  const { cover } = getPreferredContent(game, 'cover', lang)

  const introText = intro.replace(/\s+/g, ' ').trim()

  const isNsfw = cover && cover.sexual >= 1
  const shouldBlur =
    isNsfw &&
    (content_limit === ContentLimit.SHOW_WITH_SPOILER ||
      content_limit === ContentLimit.NEVER_SHOW_NSFW_CONTENT ||
      !content_limit)

  return (
    <Link href={`/game/${game.id}`} className={cn('group block', className)}>
      <Card
        className={cn(
          'relative overflow-hidden p-0',
          'border-border/60 bg-linear-to-br from-background/95 via-background/85 to-muted/40',
          'transition-colors duration-200 hover:border-primary/45',
        )}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/30 blur-2xl" />
        <CardContent className="relative p-3">
          <div className="flex items-start gap-3">
            <div className="w-16 shrink-0 sm:w-18">
              <div className="relative overflow-hidden rounded-md border border-border/50 bg-muted aspect-3/4">
                {cover &&
                  (shouldBlur ? (
                    <Spoiler blur={32} className="absolute inset-0" showHidden={false} open={false}>
                      <FadeImage
                        src={cover.url}
                        alt={title}
                        className="absolute inset-0"
                        imageClassName="object-cover"
                        sizes="96px"
                      />
                    </Spoiler>
                  ) : (
                    <FadeImage
                      src={cover.url}
                      alt={title}
                      className="absolute inset-0"
                      imageClassName="object-cover"
                      sizes="96px"
                    />
                  ))}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] leading-none text-muted-foreground/80">#{game.id}</p>
                  <h4 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                    {title}
                  </h4>
                </div>
                <span className="pt-0.5 text-xs text-muted-foreground transition-colors group-hover:text-primary">
                  ↗
                </span>
              </div>

              {introText ? (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {introText}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
