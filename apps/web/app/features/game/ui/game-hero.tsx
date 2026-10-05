import { cn, Grid, Heading, Inline, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useLocale } from 'use-intl'
import type { ResourceSummary } from '~/features/resource'
import { CatalogAttribution } from '~/shared/ui/catalog-attribution'
import {
  bannerIndex,
  gameTitle,
  originalTitle,
  type GameHeader,
  type GameImage,
  type Scores,
} from '../game'
import { GameActions } from './game-actions'
import { GameAliases } from './game-aliases'
import { GameBanner } from './game-banner'
import { GameByline } from './game-byline'
import { GameChips } from './game-chips'
import { GameCover } from './game-covers'
import { GameRatings } from './game-ratings'

type GameHeroProps = {
  game: GameHeader
  images: readonly GameImage[]
  intro: string
  scores: Promise<Scores>
  resources: ResourceSummary
  favorite: ReactNode
}

export function GameHero({ game, images, intro, scores, resources, favorite }: GameHeroProps) {
  const locale = useLocale()
  const title = gameTitle(game, locale)
  const original = originalTitle(game, locale)
  const banner = bannerIndex(images, game.content_limit)
  const staged = banner !== undefined
  return (
    <Stack as="header" gap="none">
      {staged && (
        <GameBanner images={images} index={banner} className="h-44 rounded-2xl sm:h-64 lg:h-80" />
      )}
      <Grid
        className={cn(
          'grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-x-8',
          staged && 'px-2 sm:px-6 lg:px-8',
        )}
      >
        <Stack
          className={cn(
            'relative self-start sm:row-span-2',
            staged && '-mt-12 sm:-mt-20 lg:-mt-24',
          )}
        >
          <GameCover
            game={game}
            title={title}
            className={cn('rounded-xl', staged && 'ring-4 ring-canvas')}
          />
        </Stack>
        <Stack gap="md" className="min-w-0 pt-4 sm:pt-5">
          <Stack gap="xs">
            <GameByline game={game} />
            <Heading level={1} size="2xl" weight="semibold" className="text-balance max-sm:text-xl">
              {title}
            </Heading>
            {original !== undefined && (
              <Text tone="muted" className="text-balance sm:text-lg">
                {original}
              </Text>
            )}
            <GameAliases aliases={game.aliases ?? []} />
          </Stack>
          <Inline gap="sm" align="center" className="gap-y-2">
            <GameChips game={game} />
            <GameRatings scores={scores} />
          </Inline>
          {intro !== '' && (
            <Text size="sm" tone="muted" className="line-clamp-2 max-w-prose max-sm:hidden">
              {intro}
            </Text>
          )}
        </Stack>
        <Inline
          justify="between"
          align="center"
          gap="md"
          className="col-span-2 gap-y-4 pt-5 sm:col-span-1 sm:col-start-2"
        >
          <GameActions game={game} resources={resources} favorite={favorite} />
          {game.h_id !== null && <CatalogAttribution entity="galgame" id={game.h_id} />}
        </Inline>
      </Grid>
    </Stack>
  )
}
