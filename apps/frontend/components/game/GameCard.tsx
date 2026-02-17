import { Card } from '@/components/shionui/Card'
import { GameCover, GameData, GameItem } from '@/interfaces/game/game.interface'
import { Link } from '@/i18n/navigation'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { getLocale } from 'next-intl/server'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { cn } from '@/utils/cn'
import { GameSearchItem } from '@/interfaces/game/game.interface'
import { Hidden } from '@/components/common/content/Hidden'

interface GameCardProps {
  game: GameItem
  content_limit?: ContentLimit
}

export const GameCard = async ({ game, content_limit }: GameCardProps) => {
  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'

  const sizes =
    '(min-width: 1280px) 240px, (min-width: 1024px) 200px, (min-width: 768px) 180px, (min-width: 640px) 160px, 45vw'

  const { title, language } = getPreferredContent(game as unknown as GameData, 'title', lang)
  const { cover, vertical, aspect } = getPreferredContent(
    game as unknown as GameData,
    'cover',
    lang,
  )
  if (!cover)
    return (
      <GameCardContent
        game={game}
        title={title}
        vertical={vertical}
        aspect={aspect}
        sizes={sizes}
        shouldBlur={false}
        language={language}
      />
    )

  const isNsfw = cover.sexual >= 1
  const shouldBlur =
    isNsfw &&
    (content_limit === ContentLimit.SHOW_WITH_SPOILER ||
      content_limit === ContentLimit.NEVER_SHOW_NSFW_CONTENT ||
      !content_limit)

  return GameCardContent({ game, cover, title, vertical, aspect, sizes, shouldBlur, language })
}

interface GameCardContentProps {
  game: GameItem
  cover?: GameCover
  title: string
  vertical: boolean
  aspect?: string
  sizes: string
  shouldBlur: boolean
  language: string
}
const GameCardContent = ({
  game,
  cover,
  title,
  vertical,
  aspect,
  sizes,
  shouldBlur,
  language,
}: GameCardContentProps) => {
  return (
    <Link href={`/game/${game.id}`} className="block group">
      <Card
        className={cn(
          'relative overflow-hidden p-0 border-0',
          'aspect-[3/4]',
          'bg-muted',
          'transition-all duration-200',
          'hover:opacity-85',
          'cursor-pointer select-none',
        )}
      >
        <div className="absolute inset-0 overflow-hidden">
          <FadeImage
            src={cover?.url ?? ''}
            alt=""
            sizes={sizes}
            className="scale-110"
            aspectRatio={aspect}
            imageClassName="object-cover blur-2xl brightness-90 dark:brightness-75 saturate-150"
            showSkeleton={false}
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center p-3 pb-16">
          {shouldBlur ? (
            <Hidden vertical={vertical} className="absolute md:inset-0" />
          ) : (
            <div
              className={cn(
                'relative rounded-lg overflow-hidden',
                'max-w-full max-h-full',
                vertical ? 'w-auto h-full' : 'w-full h-auto',
              )}
            >
              <CoverImage src={cover?.url ?? ''} alt={title} aspect={aspect} sizes={sizes} />
            </div>
          )}
        </div>

        <div
          className={cn(
            'absolute inset-x-0 bottom-0 h-24',
            'bg-gradient-to-t from-black/20 via-black/10 dark:via-black/20 to-transparent',
            'pointer-events-none',
          )}
        />

        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="flex flex-col gap-2">
            {typeof game === 'object' && '_formatted' in game ? (
              <h3
                className={cn(
                  'text-white font-medium text-base leading-tight',
                  'line-clamp-2',
                  'drop-shadow-md',
                  'transition-colors duration-200',
                )}
                dangerouslySetInnerHTML={{
                  __html:
                    (game as GameSearchItem)._formatted?.[
                      `title_${language}` as keyof GameSearchItem['_formatted']
                    ] || title,
                }}
              />
            ) : (
              <h3
                className={cn(
                  'text-white font-medium text-base leading-tight',
                  'line-clamp-2',
                  'drop-shadow-md',
                  'transition-colors duration-200',
                )}
              >
                {title}
              </h3>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

const CoverImage = ({
  src,
  alt,
  aspect,
  sizes,
}: {
  src: string
  alt: string
  aspect?: string
  sizes: string
}) => {
  return (
    <FadeImage
      src={src}
      alt={alt}
      sizes={sizes}
      aspectRatio={aspect}
      imageClassName="object-cover"
    />
  )
}
