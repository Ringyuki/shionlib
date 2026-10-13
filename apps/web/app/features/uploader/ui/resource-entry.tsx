import { Inline, Link, Stack, Tag, Time } from '@hina-ui/react'
import { Clock, Download, Gamepad2 } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gamePath, gameTitle } from '~/features/game'
import {
  awaitedVolumes,
  CompositionProgress,
  CompositionTag,
  missingInfo,
  ResourceMenu,
  ResourceTags,
  resourceAnchor,
  resourcePath,
  rightsOver,
  runStatus,
  type Composition,
  type ResourceViewer,
} from '~/features/resource'
import { useBytes } from '~/shared/i18n/use-bytes'
import { stageOf, type OwnResource } from '../uploader'
import { EntryShell } from './entry-shell'
import { FileLine } from './file-line'
import { Fact } from './fact'
import { ResourceFileLine } from './resource-file'
import { StageTag } from './stage-tag'

type ResourceEntryProps = {
  own: OwnResource
  viewer: ResourceViewer | null
  composition: Composition | undefined
}

export function ResourceEntry({ own, viewer, composition }: ResourceEntryProps) {
  const t = useTranslations('uploader.list')
  const bytes = useBytes()
  const locale = useLocale()
  const { game, resource } = own
  const files = resource.files ?? []
  const page = resource.published_at === null ? undefined : resourcePath(locale, resource.id)
  const awaited = awaitedVolumes(resource)
  return (
    <EntryShell
      as="article"
      files={
        files.length === 0 && composition !== undefined ? (
          <FileLine
            name={composition.file_name}
            size={t('estimate', { size: bytes(composition.estimated_size) })}
            state={<CompositionTag status={runStatus(composition) ?? 'running'} />}
          />
        ) : (
          files.map(file => (
            <ResourceFileLine key={file.id} file={file} awaited={awaited} to={page} />
          ))
        )
      }
      notice={
        composition !== undefined && (
          <Stack className="col-span-2 ps-6">
            <CompositionProgress composition={composition} />
          </Stack>
        )
      }
      stage={<StageTag stage={stageOf(resource)} />}
      controlSlots={1}
      controls={
        <ResourceMenu
          resource={resource}
          gameId={game.id}
          rights={rightsOver(resource, viewer)}
          files={files}
        />
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
            <ResourceTags resource={resource} />
            {missingInfo(resource).map(missing => (
              <Tag key={missing} size="sm" tone="warning">
                {t(`missing.${missing}`)}
              </Tag>
            ))}
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
