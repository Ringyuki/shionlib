import { SettingsPage } from '~/features/admin-setting'
import type { Route } from './+types/admin.settings'

export { settingsLoader as loader } from '~/features/admin-setting/admin-setting.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, , , , admin] = matches
  return [{ title: `${admin.loaderData.messages.adminSetting.title} | Shionlib` }]
}

export default function AdminSettings({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <SettingsPage settings={loaderData} viewer={site.loaderData.viewer} />
}
