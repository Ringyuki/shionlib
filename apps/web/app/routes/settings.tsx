import { Outlet } from 'react-router'
import { SettingsPage } from '~/features/settings'
import type { Route } from './+types/settings'
import { pageMeta } from '~/shared/seo/seo'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.settings.title, indexable: false })
}

export default function SettingsRoute({ matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <SettingsPage signedIn={site.loaderData.viewer !== null}>
      <Outlet />
    </SettingsPage>
  )
}
