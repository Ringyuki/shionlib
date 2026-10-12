import {
  Avatar,
  Card,
  cn,
  Grid,
  Inline,
  Link,
  Stack,
  Tag,
  Text,
  Time,
  useImageResolver,
} from '@hina-ui/react'
import { Clock, Download, MessageCircle } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import { PlatformTag } from '~/features/game'
import { labelOf } from '~/shared/i18n/labels'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { entryLink } from '~/shared/ui/entry-link'
import { resourceAnchor, rightsOver, type Resource, type ResourceViewer } from '../resource'
import { resourcePath } from '../resource-page'
import { ResourceMenu } from './resource-menu'
import { ResourceFiles } from './resource-files'

type ResourceCardProps = {
  resource: Resource
  viewer: ResourceViewer | null
}

export function ResourceCard({ resource, viewer }: ResourceCardProps) {
  const t = useTranslations('resource')
  const labels = useMessages()
  const locale = useLocale()
  const format = useFormatter()
  const resolveImage = useImageResolver()
  const { creator } = resource
  const note = resource.note?.trim() ?? ''
  const rights = rightsOver(resource, viewer)
  const files = resource.files ?? []
  return (
    <Card
      as="article"
      padded={false}
      id={resourceAnchor(resource.id)}
      className="relative scroll-mt-24 overflow-visible"
    >
      <Stack className="absolute inset-0 rounded-[inherit]">
        <RouterLink
          to={resourcePath(locale, resource.id)}
          prefetch="intent"
          aria-label={t('open', { name: files[0]?.file_name ?? '', others: files.length - 1 })}
          className={cn(entryLink, 'size-full rounded-[inherit]')}
        />
      </Stack>
      <Stack gap="sm" className="pointer-events-none relative p-4">
        <Grid className="grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Inline gap="xs">
            {(resource.platform ?? []).map(platform => (
              <PlatformTag key={platform} platform={platform} size="lg" />
            ))}
            {(resource.language ?? []).map(language => (
              <Tag key={language} size="lg" variant="outline">
                {labelOf(labels.game.language, language)}
              </Tag>
            ))}
            {resource.simulator !== null && (
              <Tag size="lg" variant="outline">
                {labelOf(labels.resource.simulatorName, resource.simulator)}
              </Tag>
            )}
          </Inline>
          <Inline
            gap="md"
            align="center"
            className="col-span-2 row-start-2 gap-y-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 [&_svg]:size-3.5 [&_svg]:text-faint"
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
            <ResourceMenu resource={resource} rights={rights} />
          </Stack>
        </Grid>
        {note !== '' && <BBCodeText source={note} size="sm" className="pointer-events-auto" />}
        <ResourceFiles resourceId={resource.id} files={files} manageable={rights.manage} />
      </Stack>
    </Card>
  )
}
