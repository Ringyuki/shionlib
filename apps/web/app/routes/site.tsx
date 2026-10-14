import { Outlet } from 'react-router'
import { AdViews, adsIn, loadPlacements, SidebarAds, useAdPage } from '~/features/ad'
import { AuthDialogProvider } from '~/features/auth'
import { UnreadMessages, countUnread } from '~/features/message'
import { SiteShell, sidebarModeFrom, useShellArea } from '~/features/shell'
import { UploadProvider } from '~/features/upload'
import { ContentLimitProvider, loadViewer } from '~/features/viewer'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/site'

export function loader(args: Route.LoaderArgs) {
  const sidebar = sidebarModeFrom(args.request.headers.get('cookie') ?? '')
  return routeLoader(args, async api => {
    const [viewer, unread, placements] = await Promise.all([
      loadViewer(api),
      countUnread(api),
      loadPlacements(api, args.params.lang, ['sidebar']),
    ])
    return { viewer, unread, sidebar, ads: adsIn(placements, 'sidebar') }
  })
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  const area = useShellArea()
  const adPage = useAdPage()
  return (
    <AuthDialogProvider signedIn={loaderData.viewer !== null}>
      <ContentLimitProvider viewer={loaderData.viewer}>
        <UploadProvider viewer={loaderData.viewer?.id}>
          <AdViews>
            <UnreadMessages loaded={loaderData.unread} signedIn={loaderData.viewer !== null}>
              {unread => (
                <SiteShell
                  viewer={loaderData.viewer}
                  sidebar={loaderData.sidebar}
                  unread={unread}
                  area={area}
                  sidebarEnd={
                    adPage ? rail => <SidebarAds ads={loaderData.ads} rail={rail} /> : undefined
                  }
                >
                  <Outlet />
                </SiteShell>
              )}
            </UnreadMessages>
          </AdViews>
        </UploadProvider>
      </ContentLimitProvider>
    </AuthDialogProvider>
  )
}
