import { Stack, VisuallyHidden } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { HomeContent } from '../home'
import { HotGames } from './hot-games'
import { MonthReleases } from './month-releases'
import { RecentResources } from './recent-resources'

export function HomePage({ month, recent, releases, hot }: HomeContent) {
  const t = useTranslations('home')
  return (
    <Stack gap="xl">
      <VisuallyHidden as="h1">{t('title')}</VisuallyHidden>
      <RecentResources block={recent} />
      <MonthReleases month={month} block={releases} />
      <HotGames block={hot} />
    </Stack>
  )
}
