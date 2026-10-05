import { Avatar, Card, Inline, Stack, Tag, Text, Time, useImageResolver } from '@hina-ui/react'
import { Clock, Download } from 'lucide-react'
import { useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { ownedBy, resourceAnchor, type Resource } from '../resource'
import { ResourceActions } from './resource-actions'
import { ResourceFiles } from './resource-files'

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
    <Card as="article" id={resourceAnchor(resource.id)} className="scroll-mt-24">
      <Stack gap="md">
        <Inline justify="between" align="center" gap="md" className="gap-y-2">
          <Inline gap="xs">
            {(resource.platform ?? []).map(platform => (
              <Tag key={platform}>{labelOf(labels.game.platform, platform)}</Tag>
            ))}
            {(resource.language ?? []).map(language => (
              <Tag key={language}>{labelOf(labels.game.language, language)}</Tag>
            ))}
            {resource.simulator !== null && (
              <Tag>{labelOf(labels.resource.simulatorName, resource.simulator)}</Tag>
            )}
          </Inline>
          <Inline gap="md" align="center" className="gap-y-1 [&_svg]:size-3.5 [&_svg]:text-faint">
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
        </Inline>
        {note !== '' && (
          <Text size="sm" className="break-words whitespace-pre-line">
            {note}
          </Text>
        )}
        <ResourceFiles files={resource.files ?? []} />
        <ResourceActions resource={resource} owned={ownedBy(resource, viewerId)} />
      </Stack>
    </Card>
  )
}
