import { Card, Inline, PageHeader, SearchInput, Select, Stack } from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { adminPaths, pageSize, useQueryDraft } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import {
  maxQueryLength,
  narrowed,
  queryDelay,
  roles,
  searchOf,
  sorts,
  statuses,
  type Filter,
} from '../admin-user'
import type { Listing } from '../admin-user.use-cases'
import { UserTable } from './user-table'

const every = 'ALL'

export function UsersPage({ filter, users, total }: Listing) {
  const t = useTranslations('adminUser')
  const stay = useInPageNavigate()
  const navigate = useNavigate()
  const show = (changes: Partial<Filter>, replace = false) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace })
  const query = useQueryDraft(filter.query, queryDelay, wanted => show({ query: wanted }, true))
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Card padded={false}>
        <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
          <SearchInput
            size="sm"
            aria-label={t('search')}
            placeholder={t('search')}
            className="w-64 max-sm:w-full"
            maxLength={maxQueryLength}
            value={query.draft}
            loading={query.searching}
            onValueChange={query.setDraft}
          />
          <Select
            size="sm"
            aria-label={t('column.role')}
            className="w-32"
            value={filter.role ?? every}
            options={[
              { value: every, label: t('everyRole') },
              ...roles.map(role => ({ value: role, label: t(`role.${role}`) })),
            ]}
            onValueChange={value => show({ role: roles.find(role => role === value) })}
          />
          <Select
            size="sm"
            aria-label={t('column.status')}
            className="w-32"
            value={filter.status ?? every}
            options={[
              { value: every, label: t('everyStatus') },
              ...statuses.map(status => ({ value: status, label: t(`status.${status}`) })),
            ]}
            onValueChange={value => show({ status: statuses.find(status => status === value) })}
          />
          <Select
            size="sm"
            aria-label={t('sortBy')}
            className="w-32 sm:ms-auto"
            value={filter.sort}
            options={sorts.map(sort => ({ value: sort, label: t(`sort.${sort}`) }))}
            onValueChange={value =>
              show({ sort: sorts.find(sort => sort === value) ?? filter.sort })
            }
          />
        </Inline>
        <UserTable
          users={users}
          paging={{ page: filter.page, pageSize, total }}
          filtered={narrowed(filter)}
          onOpen={user => void navigate(adminPaths.user(user.id))}
        />
      </Card>
    </Stack>
  )
}
