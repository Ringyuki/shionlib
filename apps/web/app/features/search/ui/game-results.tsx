import { DataList, Empty, Switch, Text } from '@hina-ui/react'
import { SearchX } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { GameRow, requiresResources, resourceRuleFor, type ResourceRule } from '~/features/game'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { resultsPageSize, resultsSearch, type ResultsAddress, type SearchResults } from '../search'

type GameResultsProps = {
  query: string
  page: number
  resources: ResourceRule | undefined
  filtered: boolean
  games: SearchResults['games']
  loading: boolean
  onGo: (address: ResultsAddress) => void
}

export function GameResults({
  query,
  page,
  resources,
  filtered,
  games,
  loading,
  onGo,
}: GameResultsProps) {
  const t = useTranslations('search.results')
  const pages = usePageTurn()
  const narrowed = requiresResources(resources, filtered)
  return (
    <DataList
      id={listStart}
      className="scroll-mt-4"
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
      onPageChange={next => pages.turn(resultsSearch({ query, page: next, resources }))}
      loading={loading}
      renderHeader={() => (
        <>
          <Text size="sm" tone="muted">
            {t('count', { total: games.total })}
          </Text>
          <Switch
            size="sm"
            checked={narrowed}
            onCheckedChange={only => onGo({ query, resources: resourceRuleFor(only, filtered) })}
          >
            {t('onlyWithResources')}
          </Switch>
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
