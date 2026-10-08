import { Outlet } from 'react-router'
import { SettingsPage } from '~/features/settings'
import type { Route } from './+types/settings'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.settings.title} | Shionlib` }]
}

export default function SettingsRoute({ matches }: Route.ComponentProps) {
  const [, , site] = matches
  return (
    <SettingsPage signedIn={site.loaderData.viewer !== null}>
      <Outlet />
    </SettingsPage>
  )
}
