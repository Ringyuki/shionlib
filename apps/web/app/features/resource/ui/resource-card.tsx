import {
  Avatar,
  Card,
  Grid,
  Inline,
  Stack,
  Tag,
  Text,
  Time,
  useImageResolver,
} from '@hina-ui/react'
import { Clock, Download } from 'lucide-react'
import { useMessages, useTranslations } from 'use-intl'
import { PlatformTag } from '~/features/game'
import { labelOf } from '~/shared/i18n/labels'
import { ownedBy, resourceAnchor, type Resource } from '../resource'
import { ResourceMenu } from './resource-menu'
import { ResourceFiles } from './resource-files'

const tagClass = 'h-7 px-2.5'

type ResourceCardProps = {
  resource: Resource
  viewerId: number | null
}

export function ResourceCard({ resource, viewerId }: ResourceCardProps) {
  const t = useTranslations('resource')
  const labels = useMessages()
  const resolveImage = useImageResolver()
  const { creator } = resource
  const note = resource.note?.trim() ?? ''
  return (
    <Card as="article" padded={false} id={resourceAnchor(resource.id)} className="scroll-mt-24">
      <Stack gap="sm" className="p-4">
        <Grid className="grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Inline gap="xs">
            {(resource.platform ?? []).map(platform => (
              <PlatformTag key={platform} platform={platform} size="md" className={tagClass} />
            ))}
            {(resource.language ?? []).map(language => (
              <Tag key={language} size="md" variant="solid" className={tagClass}>
                {labelOf(labels.game.language, language)}
              </Tag>
            ))}
            {resource.simulator !== null && (
              <Tag size="md" variant="solid" className={tagClass}>
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
                className="size-5 shrink-0 text-[0.625rem]"
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
          </Inline>
          <Stack className="col-start-2 row-start-1 sm:col-start-3">
            <ResourceMenu resource={resource} owned={ownedBy(resource, viewerId)} />
          </Stack>
        </Grid>
        {note !== '' && (
          <Text size="sm" className="break-words whitespace-pre-line">
            {note}
          </Text>
        )}
        <ResourceFiles files={resource.files ?? []} />
      </Stack>
    </Card>
  )
}
