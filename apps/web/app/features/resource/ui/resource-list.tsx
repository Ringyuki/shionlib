import { Empty, Grid, Link, Stack, Text } from '@hina-ui/react'
import { ExternalLink, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { DownloadArea } from '~/features/download'
import { gameTitle, type GameHeader } from '~/features/game'
import { sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import type { Resource, ResourceViewer } from '../resource'
import { moyuSite, type MoyuEntry } from '../resource-listing'
import { useResourceListing } from '../use-resource-listing'
import { listColumns } from './list-columns'
import { ListFilterSheet } from './list-filter-sheet'
import { ListToolbar } from './list-toolbar'
import { MoyuCard } from './moyu-card'
import { ResourceCard } from './resource-card'

type ResourceListProps = {
  game: Pick<GameHeader, 'id' | 'title_zh' | 'title_jp' | 'title_en' | 'b_id' | 'v_id' | 'h_id'>
  resources: readonly Resource[]
  entries: readonly MoyuEntry[]
  viewer: ResourceViewer | null
}

export function ResourceList({ game, resources, entries, viewer }: ResourceListProps) {
  const t = useTranslations('resource')
  const locale = useLocale()
  const listing = useResourceListing(resources, entries)
  const [filtering, setFiltering] = useState(false)
  if (listing.total === 0) {
    return (
      <Empty
        title={t('empty')}
        actions={
          <Button asChild loginRequired>
            <RouterLink to={`${sitePaths(locale).upload}?game=${game.id}`}>
              <Upload aria-hidden />
              {t('uploadFirst')}
            </RouterLink>
          </Button>
        }
      />
    )
  }
  return (
    <DownloadArea
      game={{ title: gameTitle(game, locale), b_id: game.b_id, v_id: game.v_id, h_id: game.h_id }}
    >
      <Stack gap="md">
        {listing.tools && (
          <ListToolbar
            groups={listing.groups}
            filter={listing.filter}
            sort={listing.sort}
            onFilter={listing.setFilter}
            onSort={listing.setSort}
            onOpenFilters={() => setFiltering(true)}
          />
        )}
        {listing.shown.length === 0 && (
          <Empty
            title={t('list.none')}
            actions={
              <Button size="sm" variant="outline" tone="neutral" onClick={listing.reset}>
                {t('list.resetAll')}
              </Button>
            }
          />
        )}
        <Grid className={listColumns.list}>
          {listing.shown.map(item =>
            item.source === 'site' ? (
              <ResourceCard
                key={item.key}
                resource={item.resource}
                gameId={game.id}
                viewer={viewer}
              />
            ) : (
              <MoyuCard key={item.key} entry={item.entry} />
            ),
          )}
        </Grid>
        {listing.shown.some(item => item.source === 'moyu') && (
          <Text size="sm" tone="muted">
            {t.rich('moyu.credit', {
              site: chunks => (
                <Link
                  href={moyuSite}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 [&_svg]:size-3.5"
                >
                  {chunks}
                  <ExternalLink aria-hidden />
                </Link>
              ),
            })}
          </Text>
        )}
      </Stack>
      <ListFilterSheet
        open={filtering}
        onOpenChange={setFiltering}
        groups={listing.groups}
        filter={listing.filter}
        total={listing.shown.length}
        onChange={listing.setFilter}
      />
    </DownloadArea>
  )
}
