import { Stack } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useLocale } from 'use-intl'
import type { ResourceSummary } from '~/features/resource'
import {
  preferredIntro,
  type CharacterCredit,
  type GameDetails,
  type GameHeader,
  type Scores,
} from '../game'
import { useViewCount } from '../use-view-count'
import { GameHero } from './game-hero'
import { GameTabs } from './game-tabs'

type GamePageProps = {
  header: GameHeader
  details: GameDetails
  characters: readonly CharacterCredit[]
  scores: Promise<Scores>
  resources: ResourceSummary
  favorite: ReactNode
  children: ReactNode
}

export function GamePage({
  header,
  details,
  characters,
  scores,
  resources,
  favorite,
  children,
}: GamePageProps) {
  const locale = useLocale()
  useViewCount(header.id)
  return (
    <GameTabs
      gameId={header.id}
      counts={{ resources: resources.count, characters: characters.length }}
      renderHeader={tabs => (
        <Stack gap="xl">
          <GameHero
            game={header}
            images={details.images ?? []}
            intro={preferredIntro(details, locale)}
            scores={scores}
            resources={resources}
            favorite={favorite}
          />
          {tabs}
        </Stack>
      )}
    >
      {children}
    </GameTabs>
  )
}
