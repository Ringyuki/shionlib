import { DataList, Empty, Switch, Text } from '@hina-ui/react'
import { SearchX } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { GameRow } from '~/features/game'
import { resultsPageSize, type ResultsAddress, type SearchResults } from '../search'

type GameResultsProps = {
  query: string
  page: number
  everyGame: boolean
  filtered: boolean
  games: SearchResults['games']
  loading: boolean
  onGo: (address: ResultsAddress) => void
}

export function GameResults({
  query,
  page,
  everyGame,
  filtered,
  games,
  loading,
  onGo,
}: GameResultsProps) {
  const t = useTranslations('search.results')
  const narrowed = filtered && !everyGame
  return (
    <DataList
      items={games.items ?? []}
      itemKey="id"
      layout="grid"
      gridMin="26rem"
      gridGap="md"
      manual
      pagination
      total={games.total}
      page={page}
      pageSize={resultsPageSize}
      onPageChange={next => onGo({ query, page: next, everyGame })}
      loading={loading}
      renderHeader={() => (
        <>
          <Text size="sm" tone="muted">
            {t('count', { total: games.total })}
          </Text>
          {filtered && (
            <Switch
              size="sm"
              checked={!everyGame}
              onCheckedChange={only => onGo({ query, everyGame: !only })}
            >
              {t('onlyWithResources')}
            </Switch>
          )}
        </>
      )}
      renderEmpty={() => (
        <Empty
          icon={<SearchX />}
          title={t('empty', { query })}
          description={narrowed ? t('emptyFiltered') : undefined}
        />
      )}
    >
      {({ item }) => <GameRow game={item} />}
    </DataList>
  )
}
