import { Stack, VisuallyHidden } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import type { HomeContent } from '../home'
import { HotGames } from './hot-games'
import { MonthReleases } from './month-releases'
import { RecentResources } from './recent-resources'

export function HomePage({
  month,
  recent,
  releases,
  hot,
  banner,
}: HomeContent & { banner: ReactNode }) {
  const t = useTranslations('home')
  return (
    <Stack gap="xl">
      <VisuallyHidden as="h1">{t('title')}</VisuallyHidden>
      {banner}
      <RecentResources block={recent} />
      <MonthReleases month={month} block={releases} />
      <HotGames block={hot} />
    </Stack>
  )
}
