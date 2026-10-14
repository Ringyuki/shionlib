import {
  Avatar,
  Card,
  cn,
  Grid,
  Inline,
  Link,
  Stack,
  Text,
  Time,
  useImageResolver,
} from '@hina-ui/react'
import { Clock, Download, MessageCircle } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { RichText } from '~/shared/ui/rich-text'
import { entryLink } from '~/shared/ui/entry-link'
import {
  awaitedVolumes,
  resourceAnchor,
  rightsOver,
  type Resource,
  type ResourceViewer,
} from '../resource'
import { resourcePath } from '../resource-page'
import { listColumns } from './list-columns'
import { ResourceMenu } from './resource-menu'
import { ResourceFiles } from './resource-files'
import { ResourceTags } from './resource-tags'

type ResourceCardProps = {
  resource: Resource
  gameId: number
  viewer: ResourceViewer | null
}

export function ResourceCard({ resource, gameId, viewer }: ResourceCardProps) {
  const t = useTranslations('resource')
  const locale = useLocale()
  const format = useFormatter()
  const resolveImage = useImageResolver()
  const { creator } = resource
  const rights = rightsOver(resource, viewer)
  const files = resource.files ?? []
  return (
    <Card
      as="article"
      padded={false}
      id={resourceAnchor(resource.id)}
      className={cn(listColumns.span, 'relative grid scroll-mt-24 overflow-visible')}
    >
      <Stack className="absolute inset-0 rounded-[inherit]">
        <RouterLink
          to={resourcePath(locale, resource.id)}
          prefetch="intent"
          aria-label={t('open', { name: files[0]?.file_name ?? '', others: files.length - 1 })}
          className={cn(entryLink, 'size-full rounded-[inherit]')}
        />
      </Stack>
      <Grid className={cn(listColumns.span, 'pointer-events-none relative gap-y-2 p-4')}>
        <Grid className="col-span-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <ResourceTags resource={resource} size="lg" />
          <Inline
            gap="md"
            align="center"
            className="col-span-2 row-start-2 min-h-7 gap-y-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 [&_svg]:size-3.5 [&_svg]:text-faint"
          >
            <Inline gap="xs" align="center" wrap={false}>
              <Avatar
                src={creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')}
                name={creator.name}
                size="sm"
              />
              <Text size="sm" tone="muted">
                {creator.name}
              </Text>
            </Inline>
            <Inline gap="xs" align="center" wrap={false}>
              <Clock aria-hidden />
              <Text size="sm" tone="muted">
                {t.rich('updated', {
                  time: () => <Time value={resource.updated} format="relative" />,
                })}
              </Text>
            </Inline>
            <Inline gap="xs" align="center" wrap={false}>
              <Download aria-hidden />
              <Text size="sm" tone="muted" className="tabular-nums">
                {t('downloads', { count: resource.downloads })}
              </Text>
            </Inline>
            {resource.comments > 0 && (
              <Link
                asChild
                tone="neutral"
                className="text-muted pointer-events-auto inline-flex items-center gap-1"
              >
                <RouterLink
                  to={resourcePath(locale, resource.id, 'comments')}
                  prefetch="intent"
                  aria-label={t('comments', { count: resource.comments })}
                >
                  <MessageCircle aria-hidden />
                  <Text as="span" size="sm" tone="muted" className="tabular-nums">
                    {format.number(resource.comments)}
                  </Text>
                </RouterLink>
              </Link>
            )}
          </Inline>
          <Stack className="pointer-events-auto col-start-2 row-start-1 sm:col-start-3">
            <ResourceMenu resource={resource} gameId={gameId} rights={rights} />
          </Stack>
        </Grid>
        {resource.note !== undefined && (
          <RichText
            document={resource.note}
            className="pointer-events-auto col-span-full text-sm"
          />
        )}
        <ResourceFiles
          resourceId={resource.id}
          files={files}
          awaited={awaitedVolumes(resource)}
          manageable={rights.manage}
        />
      </Grid>
    </Card>
  )
}
