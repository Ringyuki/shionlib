import { Inline, Link, Stack } from '@hina-ui/react'
import { ArrowLeft } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale } from 'use-intl'
import { gamePath, gameTitle } from '~/features/game'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { awaitedVolumes, rightsOver, type ResourceViewer } from '../resource'
import { inspectionOf, noticeOf, type ResourcePage } from '../resource-page'
import { ComposingFile } from './composing-file'
import { CompositionLineage } from './composition-lineage'
import { CompositionRun } from './composition-run'
import { PageFile } from './page-file'
import { PageNotice } from './page-notice'
import { ResourceFacts } from './resource-facts'
import { ResourceMenu } from './resource-menu'

type ResourceHeadProps = {
  page: ResourcePage
  viewer: ResourceViewer | null
}

export function ResourceHead({ page, viewer }: ResourceHeadProps) {
  const locale = useLocale()
  const { resource, game } = page
  const files = resource.files ?? []
  const note = resource.note?.trim() ?? ''
  const rights = rightsOver(resource, viewer)
  const notice = noticeOf(files, awaitedVolumes(resource))
  const { current, latest } = page.lineage
  const rebuildable =
    rights.manage &&
    latest !== null &&
    !latest.base_gone &&
    current === null &&
    resource.published_at !== null
  return (
    <Stack as="header" gap="md">
      <Stack gap="sm">
        <Link
          asChild
          tone="neutral"
          className="text-muted inline-flex items-center gap-1.5 self-start"
        >
          <RouterLink to={gamePath(locale, game.id)} prefetch="intent">
            <ArrowLeft aria-hidden className="size-4" />
            {gameTitle(game, locale)}
          </RouterLink>
        </Link>
        <Stack gap="md">
          {files.map((file, index) => (
            <PageFile
              key={file.id}
              resourceId={resource.id}
              file={file}
              inspection={inspectionOf(file, page.inspections)}
              leading={index === 0}
            />
          ))}
          {files.length === 0 && current !== null && <ComposingFile composition={current} />}
        </Stack>
      </Stack>
      <Inline gap="md" align="center" wrap={false}>
        <ResourceFacts resource={resource} />
        <ResourceMenu
          resource={resource}
          gameId={game.id}
          rights={rights}
          files={files}
          history={false}
          rebuildable={rebuildable}
          composing={current !== null && !current.rebuild}
        />
      </Inline>
      {notice !== undefined && (
        <PageNotice
          notice={notice}
          published={resource.published_at !== null}
          own={viewer?.id === resource.creator.id}
        />
      )}
      {latest !== null && <CompositionLineage origin={latest} />}
      {current !== null && (
        <CompositionRun composition={current} previous={resource.patch_version} />
      )}
      {note !== '' && <BBCodeText source={note} />}
    </Stack>
  )
}
