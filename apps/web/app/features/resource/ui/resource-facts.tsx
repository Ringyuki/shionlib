import { Avatar, Inline, Link, Text, useImageResolver } from '@hina-ui/react'
import { Download } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import type { Resource } from '../resource'
import { ResourceTags } from './resource-tags'

export function ResourceFacts({ resource }: { resource: Resource }) {
  const t = useTranslations('resource')
  const locale = useLocale()
  const format = useFormatter()
  const resolveImage = useImageResolver()
  const { creator } = resource
  const published = resource.published_at ?? resource.created
  return (
    <Inline gap="md" align="center" className="min-w-0 flex-1 gap-y-2">
      <ResourceTags resource={resource} />
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
