'use client'

import { GameCover as GameCoverInterface } from '@/interfaces/game/game.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { useMedia } from 'react-use'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { GameCoverDialog } from './GameCoverDialog'
import { GameCoverDrawer } from './GameCoverDrawer'
import { useState } from 'react'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { Spoiler } from '@/components/shionui/Spoiler'
import { PreferredCover } from '../description/helpers/getPreferredContent'

interface GameCoverProps {
  covers: GameCoverInterface[]
  preferredCoverInfo: PreferredCover
  title: string
  content_limit?: ContentLimit
}

const _GameCover = ({ cover, title, width }: { cover: string; title: string; width: number }) => {
  return (
    <FadeImage
      src={cover}
      alt={title}
      height={300}
      fill={false}
      width={width}
      imageClassName="h-full w-full"
    />
  )
}

export const GameCover = ({ covers, preferredCoverInfo, title, content_limit }: GameCoverProps) => {
  const t = useTranslations('Components.Game.Cover.GameCover')

  const isMobile = useMedia('(max-width: 768px)', false)
  const [open, setOpen] = useState(false)

  if (!preferredCoverInfo.cover)
    return (
      <div
        className="w-full lg:w-fit overflow-hidden h-[200px] lg:h-[300px] relative group/cover"
        style={{ aspectRatio: '1 / 1.5' }}
      />
    )

  const { cover: preferredCover, aspect } = preferredCoverInfo
  const width = aspect === '1 / 1' ? 300 : aspect === '1 / 1.5' ? 200 : 450

  return (
    <>
      <div
        className="w-full lg:w-fit overflow-hidden h-[200px] lg:h-[300px] relative group/cover"
        style={{ aspectRatio: aspect }}
      >
        {(() => {
          if (preferredCover.sexual >= 1) {
            if (
              content_limit === ContentLimit.SHOW_WITH_SPOILER ||
              content_limit === ContentLimit.NEVER_SHOW_NSFW_CONTENT ||
              !content_limit
            )
              return (
                <Spoiler showHint={true} blur={32} className="rounded-none! h-full!">
                  <_GameCover cover={preferredCover.url} title={title} width={width} />
                </Spoiler>
              )
            if (content_limit === ContentLimit.JUST_SHOW)
              return _GameCover({ cover: preferredCover.url, title, width })
          }
          return _GameCover({ cover: preferredCover.url, title, width })
        })()}
        {covers.length > 0 && (
          <div className="absolute top-2 right-2 md:right-auto md:left-1/2 md:-translate-x-1/2 opacity-100 md:opacity-0 group-hover/cover:opacity-100 transition-all duration-200">
            <Button
              intent="secondary"
              className="text-xs hover:bg-neutral-content active:bg-neutral-content dark:hover:bg-neutral/85 dark:active:bg-neutral/95"
              size="xs"
              onClick={() => setOpen(true)}
            >
              {t('viewAllCovers')}
            </Button>
          </div>
        )}
      </div>
      {isMobile ? (
        <GameCoverDrawer
          covers={covers}
          title={title}
          open={open}
          onOpenChange={setOpen}
          content_limit={content_limit}
        />
      ) : (
        <GameCoverDialog
          covers={covers}
          title={title}
          open={open}
          onOpenChange={setOpen}
          content_limit={content_limit}
        />
      )}
    </>
  )
}
