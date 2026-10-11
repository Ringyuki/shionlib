import { Inline, Link, Stack } from '@hina-ui/react'
import { ArrowLeft } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale } from 'use-intl'
import { gamePath, gameTitle } from '~/features/game'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { rightsOver, type ResourceViewer } from '../resource'
import { inspectionOf, type ResourcePage } from '../resource-page'
import { PageFile } from './page-file'
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
        </Stack>
      </Stack>
      <Inline gap="md" align="center" wrap={false}>
        <ResourceFacts resource={resource} />
        <ResourceMenu resource={resource} rights={rights} files={files} history={false} />
      </Inline>
      {note !== '' && <BBCodeText source={note} />}
    </Stack>
  )
}
