import {
  Avatar,
  Blockquote,
  Card,
  Heading,
  Inline,
  Stack,
  Tag,
  Text,
  Time,
  useImageResolver,
} from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { ownedBy, resourceAnchor, type Resource } from '../resource'
import { ResourceFiles } from './resource-files'
import { ResourceMenu } from './resource-menu'

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
  const identity = [
    ...(resource.platform ?? []).map(platform => labelOf(labels.game.platform, platform)),
    ...(resource.language ?? []).map(language => labelOf(labels.game.language, language)),
  ].join(' · ')
  return (
    <Card
      as="article"
      padded={false}
      id={resourceAnchor(resource.id)}
      className="scroll-mt-24 overflow-hidden"
    >
      <Stack gap="md" className="px-5 py-4">
        <Inline justify="between" align="start" gap="md" wrap={false}>
          <Stack gap="xs" className="min-w-0">
            <Inline gap="sm" align="center">
              <Heading level={3} size="md" weight="semibold">
                {identity}
              </Heading>
              {resource.simulator !== null && (
                <Tag size="sm" variant="outline">
                  {labelOf(labels.resource.simulatorName, resource.simulator)}
                </Tag>
              )}
            </Inline>
            <Inline gap="sm" align="center" wrap={false}>
              <Avatar
                src={creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')}
                name={creator.name}
                size="sm"
                className="size-5 shrink-0 text-[0.625rem]"
              />
              <Text size="xs" tone="muted" className="min-w-0">
                {t.rich('byline', {
                  name: creator.name,
                  time: () => <Time value={resource.updated} format="relative" />,
                })}
                {' · '}
                {t('downloads', { count: resource.downloads })}
              </Text>
            </Inline>
          </Stack>
          <ResourceMenu resource={resource} owned={ownedBy(resource, viewerId)} />
        </Inline>
        {note !== '' && (
          <Blockquote className="m-0 text-sm break-words whitespace-pre-line">{note}</Blockquote>
        )}
      </Stack>
      <ResourceFiles files={resource.files ?? []} />
    </Card>
  )
}
