import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { settingHistoryLoader } from './admin-setting.server'

export function useSettingHistory() {
  const history = useLazyLoad(useFetcher<typeof settingHistoryLoader>())
  return {
    changes: history.result,
    loading: history.loading,
    failed: history.failed,
    load: (name: string) =>
      void history.load(
        `${href('/resources/admin/settings/history')}?${new URLSearchParams({ name })}`,
      ),
  }
}
