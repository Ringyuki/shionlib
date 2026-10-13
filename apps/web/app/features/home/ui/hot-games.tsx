import { DataList, Stack } from '@hina-ui/react'
import { useLocale, useTranslations } from 'use-intl'
import { GameTile, type GameSummary } from '~/features/game'
import { sitePaths } from '~/features/shell'
import type { Block } from '../home'
import { BlockFailure } from './block-failure'
import { SectionHeader } from './section-header'

export function HotGames({ block }: { block: Block<GameSummary[]> }) {
  const t = useTranslations('home')
  const locale = useLocale()
  return (
    <Stack as="section" gap="md">
      <SectionHeader
        heading={t('hot')}
        more={{ label: t('library'), to: sitePaths(locale).games }}
      />
      {block.ok ? (
        <DataList items={block.data} itemKey="id" layout="grid" gridMin="9rem" gridGap="md">
          {({ item }) => <GameTile game={item} dated="year" />}
        </DataList>
      ) : (
        <BlockFailure />
      )}
    </Stack>
  )
}
