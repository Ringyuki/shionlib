import { DataList, Empty, Heading, Result, SearchInput, Stack, Text } from '@hina-ui/react'
import { SearchX } from 'lucide-react'
import { Form, useLocation, useNavigate, useNavigation } from 'react-router'
import { useTranslations } from 'use-intl'
import { GameRow } from '~/features/game'
import { resultsPageSize, type SearchResults } from '../search'

type SearchResultsViewProps = {
  query: string
  page: number
  games: SearchResults['games']
  unavailable: boolean
}

export function SearchResultsView({ query, page, games, unavailable }: SearchResultsViewProps) {
  const t = useTranslations('search')
  const navigate = useNavigate()
  const navigation = useNavigation()
  const location = useLocation()
  const searching =
    navigation.state === 'loading' && navigation.location.pathname === location.pathname

  const turn = (next: number) => {
    void navigate(`?${new URLSearchParams({ q: query, page: String(next) })}`)
  }

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Heading level={1} size="xl" weight="semibold">
          {query === '' ? t('results.title') : t('results.heading', { query })}
        </Heading>
        {query !== '' && !unavailable && (
          <Text size="sm" tone="muted">
            {t('results.count', { total: games.total })}
          </Text>
        )}
      </Stack>
      <Form method="get" role="search" className="w-full max-w-xl">
        <SearchInput
          key={query}
          name="q"
          defaultValue={query}
          placeholder={t('placeholder')}
          aria-label={t('label')}
        />
      </Form>
      {query === '' ? (
        <Text tone="muted">{t('results.prompt')}</Text>
      ) : unavailable ? (
        <Result status="warning" title={t('results.unavailable')} />
      ) : (
        <DataList
          items={games.items ?? []}
          itemKey="id"
          manual
          pagination
          total={games.total}
          page={page}
          pageSize={resultsPageSize}
          onPageChange={turn}
          loading={searching}
          layout="grid"
          gridMin="100%"
          gridGap="sm"
          renderEmpty={() => <Empty icon={<SearchX />} title={t('results.empty', { query })} />}
        >
          {({ item }) => <GameRow game={item} />}
        </DataList>
      )}
    </Stack>
  )
}
