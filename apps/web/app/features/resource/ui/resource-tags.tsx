import { Chip, Inline, Tag } from '@hina-ui/react'
import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import { useLocale, useMessages } from 'use-intl'
import { PlatformTag } from '~/features/game'
import { translatorPath } from '~/features/translator'
import { labelOf } from '~/shared/i18n/labels'
import type { Resource } from '../resource'
import { creditsOf, editionText } from '../resource-info'

type ResourceTagsProps = {
  resource: Resource
  size?: Extract<ComponentProps<typeof Tag>['size'], 'sm' | 'lg'>
}

export function ResourceTags({ resource, size = 'sm' }: ResourceTagsProps) {
  const labels = useMessages()
  const locale = useLocale()
  const names = labels.resource
  const edition = editionText(resource, value => labelOf(names.editionName, value))
  return (
    <Inline gap="xs" align="center">
      {(resource.platform ?? []).map(platform => (
        <PlatformTag key={platform} platform={platform} size={size} />
      ))}
      {(resource.language ?? []).map(language => (
        <Tag key={language} size={size} variant="outline">
          {labelOf(labels.game.language, language)}
        </Tag>
      ))}
      {resource.simulator !== null && (
        <Tag size={size} variant="outline">
          {labelOf(names.simulatorName, resource.simulator)}
        </Tag>
      )}
      {resource.translation === 'official' && (
        <Tag size={size} tone="accent">
          {names.translationName.official}
        </Tag>
      )}
      {resource.translation === 'machine' && (
        <Tag size={size} tone="warning">
          {names.translationName.machine}
        </Tag>
      )}
      {creditsOf(resource).map(translator => (
        <Chip
          key={translator.id}
          asChild
          variant="outline"
          size={size === 'lg' ? 'md' : 'sm'}
          className="pointer-events-auto"
        >
          <Link to={translatorPath(locale, translator.id)} prefetch="intent">
            {translator.name}
          </Link>
        </Chip>
      ))}
      {resource.patch_version !== null && <Tag size={size}>{resource.patch_version}</Tag>}
      {edition !== '' && <Tag size={size}>{edition}</Tag>}
      {resource.form !== null && <Tag size={size}>{labelOf(names.formName, resource.form)}</Tag>}
      {(resource.extras ?? []).map(extra => (
        <Tag key={extra} size={size}>
          {labelOf(names.extraName, extra)}
        </Tag>
      ))}
    </Inline>
  )
}
