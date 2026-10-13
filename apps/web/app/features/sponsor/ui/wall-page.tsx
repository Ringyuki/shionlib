import { Card, Empty, Masonry, PageHeader, Pagination, Skeleton, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { cardOf, wallPageSize, type Self } from '../sponsor'
import type { Wall } from '../sponsor.use-cases'
import { SponsorCard } from './sponsor-card'
import { WallAction } from './wall-action'

type WallPageProps = {
  wall: Wall
  viewer: Self | null
}

const columnWidth = 300

const placeholders = [3, 2, 4, 2, 3, 2]

export function WallPage({ wall, viewer }: WallPageProps) {
  const t = useTranslations('sponsor')
  const pages = usePageTurn()
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} actions={<WallAction state={wall.state} viewer={viewer} />} />
      <Masonry
        items={wall.entries}
        getKey={entry => entry.id}
        minColumnWidth={columnWidth}
        id={listStart}
        className="scroll-mt-4"
        label={t('sponsors')}
        empty={<Empty title={t('empty')} />}
        pending={
          <Stack aria-hidden className="block columns-[300px] gap-[var(--hn-masonry-gap)]">
            {placeholders.map((lines, index) => (
              <Card key={index} className="mb-[var(--hn-masonry-row-gap)] break-inside-avoid">
                <Stack gap="sm">
                  <Skeleton className="size-12 rounded-full" />
                  {Array.from({ length: lines }, (_, line) => (
                    <Skeleton key={line} className="h-4 w-full rounded" />
                  ))}
                </Stack>
              </Card>
            ))}
          </Stack>
        }
      >
        {({ item }) => <SponsorCard card={cardOf(item)} />}
      </Masonry>
      <Pagination
        total={wall.total}
        pageSize={wallPageSize}
        value={wall.page}
        onValueChange={pages.turnTo}
        pending={pages.turning}
        hideSinglePage
      />
    </Stack>
  )
}
