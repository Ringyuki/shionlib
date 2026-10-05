import { Grid, Stack } from '@hina-ui/react'
import type { ReactNode } from 'react'
import type { ResourceSummary } from '~/features/resource'
import type { CharacterCredit, GameHeader, Scores } from '../game'
import { useViewCount } from '../use-view-count'
import { GamePanel } from './game-panel'
import { GameTabs } from './game-tabs'
import { GameTitle } from './game-title'

const layout = [
  'grid-cols-[minmax(0,1fr)] gap-y-6',
  '[grid-template-areas:"title"_"panel"_"main"]',
  'lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8',
  'lg:[grid-template-areas:"panel_title"_"panel_main"]',
].join(' ')

type GamePageProps = {
  header: GameHeader
  characters: readonly CharacterCredit[]
  scores: Promise<Scores>
  resources: ResourceSummary
  favorite: ReactNode
  children: ReactNode
}

export function GamePage({
  header,
  characters,
  scores,
  resources,
  favorite,
  children,
}: GamePageProps) {
  useViewCount(header.id)
  return (
    <Grid className={layout}>
      <GamePanel
        game={header}
        scores={scores}
        resources={resources}
        favorite={favorite}
        className="overflow-hidden [grid-area:panel] lg:sticky lg:top-6 lg:self-start"
      />
      <GameTitle game={header} className="[grid-area:title]" />
      <Stack className="min-w-0 [grid-area:main]">
        <GameTabs
          gameId={header.id}
          counts={{ resources: resources.count, characters: characters.length }}
        >
          {children}
        </GameTabs>
      </Stack>
    </Grid>
  )
}
