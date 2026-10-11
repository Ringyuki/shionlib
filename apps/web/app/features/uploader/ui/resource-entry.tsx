import { Inline, Link, Tag, Time } from '@hina-ui/react'
import { Clock, Download, Gamepad2 } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { gamePath, gameTitle, PlatformTag } from '~/features/game'
import {
  ResourceMenu,
  resourceAnchor,
  resourcePath,
  rightsOver,
  type ResourceViewer,
} from '~/features/resource'
import { labelOf } from '~/shared/i18n/labels'
import { stageOf, type OwnResource } from '../uploader'
import { EntryShell } from './entry-shell'
import { Fact } from './fact'
import { ResourceFileLine } from './resource-file'
import { StageTag } from './stage-tag'

type ResourceEntryProps = {
  own: OwnResource
  viewer: ResourceViewer | null
}

export function ResourceEntry({ own, viewer }: ResourceEntryProps) {
  const t = useTranslations('uploader.list')
  const locale = useLocale()
  const labels = useMessages()
  const { game, resource } = own
  const files = resource.files ?? []
  const page = resource.published_at === null ? undefined : resourcePath(locale, resource.id)
  return (
    <EntryShell
      as="article"
      files={files.map(file => (
        <ResourceFileLine key={file.id} file={file} to={page} />
      ))}
      stage={<StageTag stage={stageOf(resource)} />}
      controlSlots={1}
      controls={
        <ResourceMenu resource={resource} rights={rightsOver(resource, viewer)} files={files} />
      }
      facts={
        <>
          <Fact icon={Gamepad2}>
            <Link asChild tone="neutral">
              <RouterLink
                to={{ pathname: gamePath(locale, game.id), hash: resourceAnchor(resource.id) }}
              >
                {gameTitle(game, locale)}
              </RouterLink>
            </Link>
          </Fact>
          <Inline gap="xs" align="center" className="min-h-5.5">
            {(resource.platform ?? []).map(platform => (
              <PlatformTag key={platform} platform={platform} />
            ))}
            {(resource.language ?? []).map(language => (
              <Tag key={language} size="sm" variant="outline">
                {labelOf(labels.game.language, language)}
              </Tag>
            ))}
            {resource.simulator !== null && (
              <Tag size="sm" variant="outline">
                {labelOf(labels.resource.simulatorName, resource.simulator)}
              </Tag>
            )}
          </Inline>
          {resource.published_at !== null && (
            <Fact icon={Download}>{t('downloads', { count: resource.downloads })}</Fact>
          )}
          <Fact icon={Clock}>
            {t.rich('updated', {
              time: () => <Time value={resource.updated} format="relative" />,
            })}
          </Fact>
        </>
      }
    />
  )
}
