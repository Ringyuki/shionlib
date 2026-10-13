import { Avatar, Button, Card, cn, Grid, Inline, Link, Stack, Text, Time } from '@hina-ui/react'
import { Clock, Download, ExternalLink, Link2 } from 'lucide-react'
import { useMessages, useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import { entryLink } from '~/shared/ui/entry-link'
import type { MoyuEntry } from '../resource-listing'
import { listColumns } from './list-columns'
import { MoyuTags } from './moyu-tags'

export function MoyuCard({ entry }: { entry: MoyuEntry }) {
  const t = useTranslations('resource')
  const kinds = useMessages().resource.list.kind
  const bytes = useBytes()
  const name = entry.name === '' ? kinds[entry.kind] : entry.name
  const size = entry.size === null ? '' : bytes(entry.size)
  return (
    <Card as="article" padded={false} className={cn(listColumns.span, 'relative grid')}>
      <Stack className="absolute inset-0 rounded-[inherit]">
        <Link
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          tone="neutral"
          aria-label={t('moyu.open', { name })}
          className={cn(entryLink, 'size-full rounded-[inherit]')}
        />
      </Stack>
      <Grid className={cn(listColumns.span, 'pointer-events-none relative gap-y-2 p-4')}>
        <Grid className="col-span-full grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <MoyuTags entry={entry} />
          <Inline
            gap="md"
            align="center"
            className="gap-y-1 sm:pe-11 [&_svg]:size-3.5 [&_svg]:text-faint"
          >
            {entry.publisher !== null && (
              <Inline gap="xs" align="center" wrap={false}>
                <Avatar
                  src={entry.publisher.avatar ?? undefined}
                  name={entry.publisher.name}
                  size="sm"
                />
                <Text size="sm" tone="muted">
                  {entry.publisher.name}
                </Text>
              </Inline>
            )}
            <Inline gap="xs" align="center" wrap={false}>
              <Clock aria-hidden />
              <Text size="sm" tone="muted">
                {t.rich('updated', {
                  time: () => <Time value={entry.updated} format="relative" />,
                })}
              </Text>
            </Inline>
            <Inline gap="xs" align="center" wrap={false}>
              <Download aria-hidden />
              <Text size="sm" tone="muted" className="tabular-nums">
                {t('downloads', { count: entry.downloads })}
              </Text>
            </Inline>
          </Inline>
        </Grid>
        <Grid className={cn(listColumns.span, 'min-h-11 items-center py-1')}>
          <Inline gap="xs" align="start" wrap={false} className={listColumns.name}>
            <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
            <Stack gap="none" className="min-w-0">
              <Text size="sm" className="break-words">
                {name}
              </Text>
              <Text size="xs" tone="muted" className="sm:hidden">
                {size}
              </Text>
            </Stack>
          </Inline>
          <Text as="span" size="sm" tone="muted" className={listColumns.size}>
            {size}
          </Text>
          <Button
            asChild
            size="sm"
            variant="outline"
            tone="neutral"
            className={cn(listColumns.wideAction, 'pointer-events-auto')}
          >
            <Link href={entry.url} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden>
              {t('moyu.go')}
              <ExternalLink aria-hidden />
            </Link>
          </Button>
        </Grid>
      </Grid>
    </Card>
  )
}
