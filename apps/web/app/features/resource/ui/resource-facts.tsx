import { Avatar, Inline, Link, Tag, Text, useImageResolver } from '@hina-ui/react'
import { Download } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import { PlatformTag } from '~/features/game'
import { profilePath } from '~/features/profile'
import { labelOf } from '~/shared/i18n/labels'
import type { Resource } from '../resource'

export function ResourceFacts({ resource }: { resource: Resource }) {
  const t = useTranslations('resource')
  const labels = useMessages()
  const locale = useLocale()
  const format = useFormatter()
  const resolveImage = useImageResolver()
  const { creator } = resource
  const published = resource.published_at ?? resource.created
  return (
    <Inline gap="md" align="center" className="min-w-0 flex-1 gap-y-2">
      <Inline gap="xs">
        {(resource.platform ?? []).map(platform => (
          <PlatformTag key={platform} platform={platform} />
        ))}
        {(resource.language ?? []).map(language => (
          <Tag key={language} variant="outline">
            {labelOf(labels.game.language, language)}
          </Tag>
        ))}
        {resource.simulator !== null && (
          <Tag variant="outline">{labelOf(labels.resource.simulatorName, resource.simulator)}</Tag>
        )}
      </Inline>
      <Link asChild tone="neutral" className="inline-flex items-center gap-1.5">
        <RouterLink to={profilePath(locale, creator.id)} prefetch="intent">
          <Avatar
            size="sm"
            name={creator.name}
            src={creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')}
            alt=""
          />
          {creator.name}
        </RouterLink>
      </Link>
      <Text size="sm" tone="muted">
        {t(resource.published_at === null ? 'page.uploaded' : 'page.published', {
          date: format.dateTime(new Date(published), { dateStyle: 'long' }),
        })}
      </Text>
      {resource.published_at !== null && (
        <Inline
          gap="xs"
          align="center"
          wrap={false}
          className="[&_svg]:size-3.5 [&_svg]:text-faint"
        >
          <Download aria-hidden />
          <Text size="sm" tone="muted" className="tabular-nums">
            {t('downloads', { count: resource.downloads })}
          </Text>
        </Inline>
      )}
    </Inline>
  )
}
