import { Outlet } from 'react-router'
import { AuthDialogProvider } from '~/features/auth'
import { UnreadMessages, countUnread } from '~/features/message'
import { SiteShell, sidebarModeFrom } from '~/features/shell'
import { UploadProvider } from '~/features/upload'
import { loadViewer } from '~/features/viewer'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/site'

export function loader(args: Route.LoaderArgs) {
  const sidebar = sidebarModeFrom(args.request.headers.get('cookie') ?? '')
  return routeLoader(args, async api => {
    const [viewer, unread] = await Promise.all([loadViewer(api), countUnread(api)])
    return { viewer, unread, sidebar }
  })
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AuthDialogProvider signedIn={loaderData.viewer !== null}>
      <UploadProvider viewer={loaderData.viewer?.id}>
        <UnreadMessages loaded={loaderData.unread} signedIn={loaderData.viewer !== null}>
          {unread => (
            <SiteShell viewer={loaderData.viewer} sidebar={loaderData.sidebar} unread={unread}>
              <Outlet />
            </SiteShell>
          )}
        </UnreadMessages>
      </UploadProvider>
    </AuthDialogProvider>
  )
}
