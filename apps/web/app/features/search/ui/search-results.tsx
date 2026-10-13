import { Heading, Result, SearchInput, Stack } from '@hina-ui/react'
import { Form, useLocation, useNavigate, useNavigation } from 'react-router'
import { useTranslations } from 'use-intl'
import type { ResourceRule } from '~/features/game'
import { resultsSearch, type ResultsAddress, type SearchResults } from '../search'
import { GameResults } from './game-results'
import { SearchPrompt } from './search-prompt'

type SearchResultsViewProps = {
  query: string
  page: number
  resources: ResourceRule | undefined
  filtered: boolean
  games: SearchResults['games']
  trending: readonly string[]
  unavailable: boolean
}

export function SearchResultsView({
  query,
  page,
  resources,
  filtered,
  games,
  trending,
  unavailable,
}: SearchResultsViewProps) {
  const t = useTranslations('search')
  const navigate = useNavigate()
  const navigation = useNavigation()
  const location = useLocation()
  const searching =
    navigation.state === 'loading' && navigation.location.pathname === location.pathname
  const go = (address: ResultsAddress) => void navigate(resultsSearch(address))

  return (
    <Stack gap="lg">
      <Stack gap="md">
        <Heading level={1} size="xl" weight="semibold">
          {query === '' ? t('results.title') : t('results.heading', { query })}
        </Heading>
        <Form
          method="get"
          role="search"
          className="w-full max-w-2xl"
          onSubmit={event => {
            event.preventDefault()
            const typed = new FormData(event.currentTarget).get('q')
            go({ query: typeof typed === 'string' ? typed : '', resources })
          }}
        >
          <SearchInput
            key={query}
            name="q"
            size="lg"
            defaultValue={query}
            loading={searching}
            placeholder={t('results.placeholder')}
            aria-label={t('label')}
          />
        </Form>
      </Stack>
      {query === '' ? (
        <SearchPrompt trending={trending} />
      ) : unavailable ? (
        <Result status="warning" title={t('results.unavailable')} />
      ) : (
        <GameResults
          query={query}
          page={page}
          resources={resources}
          filtered={filtered}
          games={games}
          loading={searching}
          onGo={go}
        />
      )}
    </Stack>
  )
}
