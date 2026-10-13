import type { ApiClient } from '~/shared/api/client'
import { historyShown, type Change, type Setting } from './admin-setting'
import { changeFrom, settingFrom, type SettingSave } from './admin-setting.schema'

export async function loadSettings(api: ApiClient): Promise<Setting[]> {
  const listed = await api.get('/admin/settings')
  return (listed ?? []).map(settingFrom).filter(setting => setting !== undefined)
}

export async function saveSettings(api: ApiClient, save: SettingSave): Promise<null> {
  await Promise.all(
    save.changes.map(change => {
      const params = { path: { name: change.name } }
      return change.restore
        ? api.delete('/admin/settings/{name}', { params })
        : api.patch('/admin/settings/{name}', { params, body: { value: change.value } })
    }),
  )
  return null
}

export async function loadHistory(api: ApiClient, name: string): Promise<Change[]> {
  const page = await api.get('/admin/settings/{name}/history', {
    params: { path: { name }, query: { page: 1, pageSize: historyShown } },
  })
  return (page.items ?? []).map(changeFrom)
}
