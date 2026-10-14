import { SettingsPage } from '~/features/admin-setting'
import type { Route } from './+types/admin.settings'
import { pageMeta } from '~/shared/seo/seo'

export { settingsLoader as loader } from '~/features/admin-setting/admin-setting.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, { title: admin.loaderData.messages.adminSetting.title, indexable: false })
}

export default function AdminSettings({ loaderData, matches }: Route.ComponentProps) {
  const [, , site] = matches
  return <SettingsPage settings={loaderData} viewer={site.loaderData.viewer} />
}
