import { Heading, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { GameGrid, loadLatestGames } from '~/features/game'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/home'

export function loader(args: Route.LoaderArgs) {
  return routeLoader(args, async api => ({ games: await loadLatestGames(api, 24) }))
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const t = useTranslations('site')
  return (
    <Stack gap="lg">
      <Heading level={1} size="xl">
        {t('latest')}
      </Heading>
      <GameGrid games={loaderData.games} />
    </Stack>
  )
}
