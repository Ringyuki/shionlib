import { Empty, SegmentedControl, Stack } from '@hina-ui/react'
import { Upload } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { labelOf } from '~/shared/i18n/labels'
import { Button } from '~/shared/ui/button'
import { platformFilterFrom, resourcePlatforms, withPlatform, type Resource } from '../resource'
import { ResourceCard } from './resource-card'

const allPlatforms = 'all'

type ResourceListProps = {
  gameId: number
  resources: readonly Resource[]
  viewerId: number | null
}

export function ResourceList({ gameId, resources, viewerId }: ResourceListProps) {
  const t = useTranslations('resource')
  const locale = useLocale()
  const labels = useMessages().game.platform
  const [platform, setPlatform] = useState<string>(allPlatforms)
  if (resources.length === 0) {
    return (
      <Empty
        title={t('empty')}
        actions={
          <Button asChild loginRequired>
            <Link to={`${sitePaths(locale).upload}?game=${gameId}`}>
              <Upload aria-hidden />
              {t('uploadFirst')}
            </Link>
          </Button>
        }
      />
    )
  }
  const platforms = resourcePlatforms(resources)
  const filtering = resources.length >= platformFilterFrom && platforms.length > 1
  const shown = withPlatform(
    resources,
    filtering && platform !== allPlatforms ? platform : undefined,
  )
  return (
    <Stack gap="md">
      {filtering && (
        <SegmentedControl
          size="sm"
          aria-label={t('filter')}
          value={platform}
          onValueChange={value => setPlatform(String(value))}
          options={[
            { value: allPlatforms, label: t('all') },
            ...platforms.map(value => ({ value, label: labelOf(labels, value) })),
          ]}
          className="self-start"
        />
      )}
      {shown.map(resource => (
        <ResourceCard key={resource.id} resource={resource} viewerId={viewerId} />
      ))}
    </Stack>
  )
}
