import { Card } from '@hina-ui/react'
import { useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { pageSize, searchSet } from '~/features/admin'
import { GatewayFrame, RangePicker } from '~/features/admin-ai'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { narrowed, searchOf, type Narrowing } from '../admin-ai-request'
import type { Listing } from '../admin-ai-request.use-cases'
import { RequestPane } from './request-pane'
import { RequestTable } from './request-table'
import { RequestsToolbar } from './requests-toolbar'

export function AiRequestsPage(listing: Listing) {
  const { filter, requests, total, summary, scenes, models, providers, opened } = listing
  const t = useTranslations('adminAiRequest')
  const location = useLocation()
  const stay = useInPageNavigate()
  const show = (changes: Partial<Narrowing>) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace: true })
  const open = (id: string | undefined) => stay({ search: searchSet(location.search, 'id', id) })
  return (
    <GatewayFrame
      tab="requests"
      actions={<RangePicker value={filter.range} onChange={range => show({ range })} />}
    >
      <Card padded={false} aria-label={t('title')}>
        <RequestsToolbar
          filter={filter}
          summary={summary}
          scenes={scenes}
          models={models}
          providers={providers}
          onShow={show}
        />
        <RequestTable
          requests={requests}
          scenes={scenes}
          paging={{ page: filter.page, pageSize, total }}
          range={filter.range}
          filtered={narrowed(filter)}
          onOpen={request => open(request.id)}
        />
      </Card>
      <RequestPane
        opened={opened}
        scenes={scenes}
        onOpen={request => open(request.id)}
        onClose={() => open(undefined)}
      />
    </GatewayFrame>
  )
}
