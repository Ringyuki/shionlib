import { Empty, Heading, Pagination, Result, SearchInput, Stack, Text } from '@hina-ui/react'
import { SearchX } from 'lucide-react'
import { Form, useNavigate, useNavigation } from 'react-router'
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
  const items = games.items ?? []

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
      ) : items.length === 0 ? (
        <Empty icon={<SearchX />} title={t('results.empty', { query })} />
      ) : (
        <Stack gap="sm">
          {items.map(game => (
            <GameRow key={game.id} game={game} />
          ))}
        </Stack>
      )}
      {items.length > 0 && (
        <Pagination
          total={games.total}
          pageSize={resultsPageSize}
          value={page}
          onValueChange={turn}
          pending={navigation.state === 'loading'}
          hideSinglePage
          align="center"
          label={t('results.pages')}
        />
      )}
    </Stack>
  )
}
