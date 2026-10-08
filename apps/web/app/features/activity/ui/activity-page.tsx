import {
  Avatar,
  Empty,
  PageHeader,
  Pagination,
  SegmentedControl,
  Stack,
  Timeline,
  useImageResolver,
} from '@hina-ui/react'
import { History } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { feedKinds, pageSize, searchOfKind, type Feed } from '../activity'
import { feedKindFrom } from '../activity.schema'
import { HappeningRow } from './happening-row'

export function ActivityPage({ feed }: { feed: Feed }) {
  const t = useTranslations('activity')
  const navigate = useNavigate()
  const location = useLocation()
  const pages = usePageTurn()
  const resolveImage = useImageResolver()
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} description={t('description')} />
      <SegmentedControl
        aria-label={t('kinds')}
        value={feed.kind}
        onValueChange={value =>
          void navigate({ search: searchOfKind(location.search, feedKindFrom(value)) })
        }
        options={feedKinds.map(kind => ({ value: kind, label: t(`kind.${kind}`) }))}
        className="self-start"
      />
      {feed.happenings.length === 0 ? (
        <Empty icon={<History />} title={t(`empty.${feed.kind}`)} />
      ) : (
        <Timeline
          aria-label={t('title')}
          items={feed.happenings}
          renderMarker={({ item }) => (
            <Avatar
              size="sm"
              name={item.user.name}
              src={item.user.avatar === null ? undefined : resolveImage(item.user.avatar, 'image')}
            />
          )}
          renderContent={({ item }) => <HappeningRow happening={item} />}
        />
      )}
      <Pagination
        total={feed.total}
        pageSize={pageSize}
        value={feed.page}
        onValueChange={pages.turnTo}
        pending={pages.turning}
        hideSinglePage
      />
    </Stack>
  )
}
