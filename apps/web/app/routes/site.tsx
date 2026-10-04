import { Container, Inline, Text } from '@hina-ui/react'
import { Link, Outlet } from 'react-router'
import { useTranslations } from 'use-intl'
import { loadViewer, ViewerBadge } from '~/features/viewer'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/site'

export function loader(args: Route.LoaderArgs) {
  return routeLoader(args, async api => ({ viewer: await loadViewer(api) }))
}

export default function SiteLayout({ loaderData, params }: Route.ComponentProps) {
  const t = useTranslations('site')
  return (
    <>
      <header className="border-b border-line">
        <Container size="xl">
          <Inline justify="between" align="center" className="h-14">
            <Link to={`/${params.lang}`}>
              <Text as="span" weight="semibold">
                {t('name')}
              </Text>
            </Link>
            <ViewerBadge viewer={loaderData.viewer} />
          </Inline>
        </Container>
      </header>
      <Container size="xl" as="main" className="py-8">
        <Outlet />
      </Container>
    </>
  )
}
