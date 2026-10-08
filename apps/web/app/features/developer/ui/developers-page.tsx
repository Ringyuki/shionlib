import { DataList, Empty, PageHeader, SearchInput, Stack } from '@hina-ui/react'
import { SearchX } from 'lucide-react'
import { Form, useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { developersPath, normalizedQuery, pageSize, type Developers } from '../developer'
import { DeveloperCard } from './developer-card'

export function DevelopersPage({ developers }: { developers: Developers }) {
  const t = useTranslations('developer')
  const locale = useLocale()
  const navigate = useNavigate()
  const pages = usePageTurn()
  const { query, page, items, total } = developers
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} description={t(query === '' ? 'count' : 'found', { total })} />
      <Form
        method="get"
        role="search"
        className="w-full max-w-md"
        onSubmit={event => {
          event.preventDefault()
          const typed = new FormData(event.currentTarget).get('q')
          void navigate(
            developersPath(locale, normalizedQuery(typeof typed === 'string' ? typed : null)),
          )
        }}
      >
        <SearchInput
          key={query}
          name="q"
          defaultValue={query}
          loading={pages.turning}
          placeholder={t('search')}
          aria-label={t('search')}
        />
      </Form>
      <DataList
        label={t('title')}
        items={items}
        itemKey="id"
        layout="grid"
        gridMin="17rem"
        gridGap="md"
        manual
        pagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={pages.turnTo}
        loading={pages.turning}
        renderEmpty={() => (
          <Empty icon={<SearchX />} title={query === '' ? t('none') : t('empty', { query })} />
        )}
      >
        {({ item }) => <DeveloperCard developer={item} />}
      </DataList>
    </Stack>
  )
}
