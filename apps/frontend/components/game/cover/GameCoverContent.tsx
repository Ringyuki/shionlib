import { GameCover } from '@/interfaces/game/game.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { cn } from '@/utils/cn'
import { JP, CN, US, TW } from 'country-flag-icons/string/3x2'
import { Languages, Proportions } from 'lucide-react'
import { Language, LanguageNameMap } from '@/interfaces/game/game.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { Spoiler } from '@/components/shionui/Spoiler'
import { MoreHorizontal as More } from 'lucide-react'
import { getAspectRatio } from '../description/helpers/getPreferredContent'

interface GameCoverContentProps {
  className?: string
  covers: GameCover[]
  title: string
  content_limit?: ContentLimit
}

const flagMap: Record<Exclude<Language, 'other'>, string> = {
  jp: JP,
  zh: CN,
  'zh-hant': TW,
  en: US,
}

const _GameCover = ({ cover, title, sizes }: { cover: string; title: string; sizes: string }) => {
  return (
    <FadeImage
      src={cover}
      alt={title}
      className="w-full h-full object-cover"
      sizes={sizes}
      fill
      onClick={() => {
        window.open(cover, '_blank')
      }}
    />
  )
}

export const GameCoverContent = ({
  covers,
  title,
  className,
  content_limit,
}: GameCoverContentProps) => {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3', 'w-full', className)}>
      {covers.map(cover => {
        const aspect = getAspectRatio(cover.dims as [number, number])
        const sizes = '(max-width: 768px) 100vw, 50vw'
        const url = cover.url.startsWith('http')
          ? cover.url
          : process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL + cover.url
        return (
          <div
            key={cover.url}
            className="relative w-full flex flex-col gap-2 cursor-pointer hover:opacity-80 transition-all duration-200"
            style={{ aspectRatio: aspect }}
          >
            {(() => {
              if (cover.sexual >= 1) {
                if (
                  content_limit === ContentLimit.SHOW_WITH_SPOILER ||
                  content_limit === ContentLimit.NEVER_SHOW_NSFW_CONTENT ||
                  !content_limit
                )
                  return (
                    <Spoiler showHint={true} blur={32} className="!rounded-none !h-full">
                      <_GameCover cover={url} title={title} sizes={sizes} />
                    </Spoiler>
                  )
                if (content_limit === ContentLimit.JUST_SHOW)
                  return <_GameCover cover={url} title={title} sizes={sizes} />
              }
              return <_GameCover cover={url} title={title} sizes={sizes} />
            })()}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Languages className="size-3" />
                {cover.language === 'other' ? (
                  <More className="size-3" />
                ) : (
                  <svg
                    className="size-3"
                    dangerouslySetInnerHTML={{ __html: flagMap[cover.language] }}
                  />
                )}
                <span className="text-xs font-light">{LanguageNameMap[cover.language]}</span>
              </div>
              <div className="flex items-center gap-1">
                <Proportions className="size-3" />
                <span className="text-xs font-light">{cover.dims.join('x')}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
