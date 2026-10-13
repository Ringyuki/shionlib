import { Stack } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useLocale } from 'use-intl'
import { DownloadArea } from '~/features/download'
import { gameTitle } from '~/features/game'
import type { ResourceViewer } from '../resource'
import type { ResourcePage as Page } from '../resource-page'
import { ResourceHead } from './resource-head'
import { ResourceTabs } from './resource-tabs'

type ResourcePageProps = {
  page: Page
  viewer: ResourceViewer | null
  children: ReactNode
}

export function ResourcePage({ page, viewer, children }: ResourcePageProps) {
  const locale = useLocale()
  const { resource, game } = page
  return (
    <DownloadArea
      game={{ title: gameTitle(game, locale), b_id: game.b_id, v_id: game.v_id, h_id: game.h_id }}
    >
      <Stack as="article" gap="lg">
        <ResourceHead page={page} viewer={viewer} />
        <ResourceTabs resourceId={resource.id} comments={resource.comments}>
          {children}
        </ResourceTabs>
      </Stack>
    </DownloadArea>
  )
}
