import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { SettingSave } from './admin-setting.schema'
import type { settingAction } from './admin-setting.server'

export function useSettingSave() {
  const command = useCommand(useFetcher<typeof settingAction>(), href('/resources/admin/settings'))
  return { ...command, run: (save: SettingSave) => command.run(save) }
}
