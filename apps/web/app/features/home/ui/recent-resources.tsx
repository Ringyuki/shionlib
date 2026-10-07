import { DataList, Empty, Stack } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { GameCard, sortedGamesPath, type GameSummary } from '~/features/game'
import { sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import type { Block } from '../home'
import { BlockFailure } from './block-failure'
import { SectionHeader } from './section-header'

export function RecentResources({ block }: { block: Block<GameSummary[]> }) {
  const t = useTranslations('home')
  const locale = useLocale()
  return (
    <Stack as="section" gap="md">
      <SectionHeader
        heading={t('recent')}
        more={{ label: t('more'), to: sortedGamesPath(locale, 'resource_updated') }}
      />
      {block.ok ? (
        <DataList
          items={block.data}
          itemKey="id"
          layout="grid"
          gridMin="22rem"
          gridGap="md"
          renderEmpty={() => (
            <Empty
              title={t('noResources')}
              actions={
                <Button asChild loginRequired>
                  <Link to={sitePaths(locale).upload}>{t('upload')}</Link>
                </Button>
              }
            />
          )}
        >
          {({ item }) => <GameCard game={item} />}
        </DataList>
      ) : (
        <BlockFailure />
      )}
    </Stack>
  )
}
