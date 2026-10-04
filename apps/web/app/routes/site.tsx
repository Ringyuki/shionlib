import { Outlet } from 'react-router'
import { AuthDialogProvider } from '~/features/auth'
import { SiteShell, sidebarModeFrom } from '~/features/shell'
import { loadViewer } from '~/features/viewer'
import { readServerEnv } from '~/shared/config/env.server'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/site'

export function loader(args: Route.LoaderArgs) {
  const sidebar = sidebarModeFrom(args.request.headers.get('cookie') ?? '')
  const { version } = readServerEnv()
  return routeLoader(args, async api => ({ viewer: await loadViewer(api), sidebar, version }))
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AuthDialogProvider signedIn={loaderData.viewer !== null}>
      <SiteShell
        viewer={loaderData.viewer}
        sidebar={loaderData.sidebar}
        version={loaderData.version}
      >
        <Outlet />
      </SiteShell>
    </AuthDialogProvider>
  )
}
