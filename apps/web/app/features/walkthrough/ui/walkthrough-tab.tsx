import { Empty, LineClamp, Stack } from '@hina-ui/react'
import { useLocale, useTranslations } from 'use-intl'
import { RichText } from '~/shared/ui/rich-text'
import { SideColumn } from '~/shared/ui/side-column'
import { useShownRoute } from '../use-shown-route'
import {
  facesOf,
  portraitsIn,
  writtenBy,
  type Credit,
  type Guides,
  type Route,
} from '../walkthrough'
import { GuideBar, WriteButton } from './guide-bar'
import { RouteNav } from './route-nav'
import { RoutePart } from './route-part'
import { RouteSheet } from './route-sheet'

type WalkthroughTabProps = {
  guides: Guides
  credits: readonly Credit[]
  viewerId: number | undefined
}

export function WalkthroughTab({ guides, credits, viewerId }: WalkthroughTabProps) {
  const t = useTranslations('walkthrough')
  const { gameId, summaries, shown } = guides
  const own = writtenBy(summaries, viewerId) !== undefined
  if (shown === undefined) {
    return <Empty title={t('empty')} actions={<WriteButton gameId={gameId} own={own} solid />} />
  }
  const routes = shown.routes ?? []
  return (
    <Stack as="section" aria-label={t('label')} gap="none" className="gap-6">
      <Stack gap="none" className="gap-3">
        <GuideBar gameId={gameId} summaries={summaries} shown={shown} own={own} />
        {shown.note !== undefined &&
          (routes.length === 0 ? (
            <RichText document={shown.note} className="max-w-prose" />
          ) : (
            <LineClamp lines={noteLines} className="max-w-prose">
              <RichText document={shown.note} />
            </LineClamp>
          ))}
      </Stack>
      {routes.length > 0 && <Routes routes={routes} credits={credits} />}
      {routes.length === 0 && shown.note === undefined && <Empty title={t('blank')} />}
    </Stack>
  )
}

const noteLines = 6

function Routes({ routes, credits }: { routes: readonly Route[]; credits: readonly Credit[] }) {
  const locale = useLocale()
  const { index, hrefOf } = useShownRoute(routes)
  const route = index === undefined ? undefined : routes[index]
  if (index === undefined || route === undefined) {
    return null
  }
  const faces = facesOf(credits, locale)
  return (
    <Stack gap="none" className="gap-4 lg:flex-row lg:gap-8">
      {routes.length > 1 && (
        <>
          <RouteSheet
            name={route.name}
            portraits={portraitsIn(route, faces)}
            ordinal={index + 1}
            count={routes.length}
            className="lg:hidden"
            renderRoutes={close => (
              <RouteNav
                routes={routes}
                faces={faces}
                index={index}
                hrefOf={hrefOf}
                roomy
                onPick={close}
              />
            )}
          />
          <SideColumn className="w-70 shrink-0 max-lg:hidden">
            <RouteNav routes={routes} faces={faces} index={index} hrefOf={hrefOf} />
          </SideColumn>
        </>
      )}
      <Stack gap="none" className="min-w-0 flex-1">
        <RoutePart routes={routes} index={index} switched={routes.length > 1} hrefOf={hrefOf} />
      </Stack>
    </Stack>
  )
}
